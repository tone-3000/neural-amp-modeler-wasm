/**
 * NamEngine: main-thread API for the NAM wasm engine.
 *
 * One engine per AudioContext. The engine registers the worklet module and
 * fetches the wasm binary once; every NamNode created from it shares the
 * single wasm module instantiated inside the AudioWorkletGlobalScope.
 * No SharedArrayBuffer, no cross-origin isolation requirement, one small
 * growable heap.
 */
import {
  NAM_PROCESSOR_NAME,
  NamModelInfo,
  NamWorkletRequest,
  NamWorkletResponse,
} from './protocol';

export type { NamModelInfo } from './protocol';

export interface NamEngineAssets {
  /**
   * Base URL for the engine assets (nam-worklet.js, nam-engine.wasm), e.g.
   * '/nam/'. When omitted, assets are resolved relative to this module's URL
   * (works out of the box with bundlers that support
   * `new URL(..., import.meta.url)` asset handling, e.g. webpack 5 / Vite).
   */
  assetBaseUrl?: string | URL;
}

export interface NamLoadOptions {
  /**
   * Raw NAM-core slimmable size in [0.0, 1.0], applied when the model is
   * slimmable (e.g. A2 models). NAM core selects the first submodel whose
   * max_value is greater than this value: with submodel thresholds
   * [0.5, 1.0], any value below 0.5 selects the smaller submodel and values
   * from 0.5 up select the full one. Omit for the full model. Non-slimmable
   * models ignore it.
   */
  slimSize?: number;
}

interface PendingRequest {
  resolve: (info?: NamModelInfo) => void;
  reject: (error: Error) => void;
}

let nextRequestId = 1;

// AudioWorkletNode is secure-context-only (and absent in Node/SSR). Extending
// a safe fallback keeps this module importable everywhere; environments
// without it fail later, at NamEngine.attach(), with a clear error.
const AudioWorkletNodeBase = (globalThis.AudioWorkletNode ??
  class {}) as typeof AudioWorkletNode;

/**
 * An AudioWorkletNode running one NAM instance (mono in, mono out).
 * Connect it into a Web Audio graph like any other node.
 */
export class NamNode extends AudioWorkletNodeBase {
  private pending = new Map<number, PendingRequest>();
  private disposed = false;

  /** @internal Use NamEngine.createNode(). */
  constructor(context: BaseAudioContext) {
    super(context, NAM_PROCESSOR_NAME, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      channelCount: 1,
      channelCountMode: 'explicit',
    });
    this.port.onmessage = (event: MessageEvent<NamWorkletResponse>) => {
      const response = event.data;
      const pending = this.pending.get(response.requestId);
      if (!pending) return;
      this.pending.delete(response.requestId);
      if (response.ok) {
        pending.resolve(response.modelInfo);
      } else {
        pending.reject(new Error(response.error));
      }
    };
  }

  /** @internal */
  request(
    message: NamWorkletRequest,
    transfer?: Transferable[]
  ): Promise<NamModelInfo | undefined> {
    if (this.disposed) {
      return Promise.reject(new Error('NamNode is disposed'));
    }
    return new Promise((resolve, reject) => {
      this.pending.set(message.requestId, { resolve, reject });
      this.port.postMessage(message, transfer ?? []);
    });
  }

  /**
   * Load a model from the contents of a .nam file, replacing any current
   * model. The model is parsed on the audio thread; rendering through this
   * node pauses for the duration (typically 100-300 ms) and fades back in
   * click-free.
   */
  async loadModel(
    json: string,
    options?: NamLoadOptions
  ): Promise<NamModelInfo> {
    const modelInfo = await this.request({
      type: 'load-model',
      requestId: nextRequestId++,
      json,
      // Negative means full model (mirrors the C API).
      slimSize: options?.slimSize ?? -1,
    });
    return modelInfo as NamModelInfo;
  }

  /** Unload the model; the node passes audio through unchanged. */
  async unloadModel(): Promise<void> {
    await this.request({ type: 'unload-model', requestId: nextRequestId++ });
  }

  /**
   * Re-slim the loaded model without reparsing (slimmable models only).
   * @param slimSize Raw NAM-core slimmable size in [0.0, 1.0].
   */
  async setSlimSize(slimSize: number): Promise<void> {
    await this.request({
      type: 'set-slim-size',
      requestId: nextRequestId++,
      slimSize,
    });
  }

  /**
   * Destroy the node's wasm instance, disconnect it from the graph, and stop
   * its processor. The node cannot be used afterwards.
   */
  async dispose(): Promise<void> {
    if (this.disposed) return;
    try {
      await this.request({ type: 'destroy', requestId: nextRequestId++ });
    } finally {
      this.disposed = true;
      for (const pending of this.pending.values()) {
        pending.reject(new Error('NamNode is disposed'));
      }
      this.pending.clear();
      this.disconnect();
    }
  }
}

// One engine per context; attach() is idempotent.
const enginesByContext = new WeakMap<BaseAudioContext, Promise<NamEngine>>();

function resolveAssetUrl(
  assetBaseUrl: string | URL | undefined,
  fallback: () => URL,
  filename: string
): URL {
  if (assetBaseUrl === undefined) return fallback();
  const base = new URL(assetBaseUrl, globalThis.location?.href);
  const withSlash = base.href.endsWith('/') ? base.href : `${base.href}/`;
  return new URL(filename, withSlash);
}

/**
 * Loads the NAM wasm engine into an AudioContext and creates NamNodes.
 */
export class NamEngine {
  private constructor(
    readonly context: BaseAudioContext,
    private readonly wasmBytes: ArrayBuffer
  ) {}

  /**
   * Attach the engine to an AudioContext: registers the worklet module and
   * fetches the wasm binary (both once per context; repeated calls return
   * the same engine).
   */
  static attach(
    context: BaseAudioContext,
    assets?: NamEngineAssets
  ): Promise<NamEngine> {
    let promise = enginesByContext.get(context);
    if (!promise) {
      promise = (async () => {
        if (!globalThis.AudioWorkletNode || !context.audioWorklet) {
          throw new Error(
            'AudioWorklet is not available. It requires a secure context: ' +
              'serve the page over https (or localhost).'
          );
        }
        // The fallbacks are literal `new URL(..., import.meta.url)` expressions
        // so bundlers (webpack 5 / Vite / Next) statically detect them and ship
        // the assets automatically. This module is emitted to dist/engine/,
        // next to the assets.
        const workletUrl = resolveAssetUrl(
          assets?.assetBaseUrl,
          () => new URL('./nam-worklet.js', import.meta.url),
          'nam-worklet.js'
        );
        const wasmUrl = resolveAssetUrl(
          assets?.assetBaseUrl,
          () => new URL('./nam-engine.wasm', import.meta.url),
          'nam-engine.wasm'
        );
        const [wasmBytes] = await Promise.all([
          (async () => {
            const response = await fetch(wasmUrl);
            if (!response.ok) {
              throw new Error(`Failed to fetch ${wasmUrl}: ${response.status}`);
            }
            return response.arrayBuffer();
          })(),
          context.audioWorklet.addModule(workletUrl),
        ]);
        return new NamEngine(context, wasmBytes);
      })();
      enginesByContext.set(context, promise);
      promise.catch(() => enginesByContext.delete(context));
    }
    return promise;
  }

  /**
   * Create a NamNode ready for model loading. The first node instantiates
   * the wasm module inside the worklet scope; later nodes share it.
   */
  async createNode(): Promise<NamNode> {
    const node = new NamNode(this.context);
    // I structured-clone the bytes rather than transfer them so the engine
    // can initialize any number of nodes from the same copy.
    await node.request({
      type: 'init',
      requestId: nextRequestId++,
      wasmBytes: this.wasmBytes,
    });
    return node;
  }
}

interface PoolEntry {
  key: string;
  node: NamNode;
}

/**
 * A small LRU pool of NamNodes keyed by an arbitrary id (e.g. a player id).
 *
 * Mounting a UI player costs nothing; a node is only created when it first
 * plays. Re-acquiring an existing key reuses its node (with its model still
 * loaded, for instant replay); acquiring a new key when the pool is full
 * evicts and disposes the least-recently-used node.
 */
export class NamNodePool {
  private entries: PoolEntry[] = [];

  /**
   * @param engine Engine to create nodes from.
   * @param maxNodes Maximum simultaneous nodes (default 1).
   * @param onEvict Called just before an evicted node is disposed, so callers
   *                can disconnect it from their graph.
   */
  constructor(
    private readonly engine: NamEngine,
    private readonly maxNodes = 1,
    private readonly onEvict?: (node: NamNode, key: string) => void
  ) {}

  /** Acquire (create or reuse) the node for a key, evicting LRU if needed. */
  async acquire(key: string): Promise<NamNode> {
    const existingIndex = this.entries.findIndex(e => e.key === key);
    if (existingIndex >= 0) {
      const [entry] = this.entries.splice(existingIndex, 1);
      this.entries.push(entry); // most recently used
      return entry.node;
    }

    while (this.entries.length >= this.maxNodes) {
      const evicted = this.entries.shift()!;
      this.onEvict?.(evicted.node, evicted.key);
      void evicted.node.dispose();
    }

    const node = await this.engine.createNode();
    this.entries.push({ key, node });
    return node;
  }

  /** Dispose one node by key. */
  async release(key: string): Promise<void> {
    const index = this.entries.findIndex(e => e.key === key);
    if (index < 0) return;
    const [entry] = this.entries.splice(index, 1);
    this.onEvict?.(entry.node, entry.key);
    await entry.node.dispose();
  }

  /** Dispose all nodes. */
  async disposeAll(): Promise<void> {
    const entries = this.entries;
    this.entries = [];
    for (const entry of entries) {
      this.onEvict?.(entry.node, entry.key);
      await entry.node.dispose();
    }
  }
}
