/**
 * NAM AudioWorkletProcessor.
 *
 * The wasm module is instantiated exactly once per AudioWorkletGlobalScope
 * (shared by every NAM node in the context) from bytes sent over the message
 * port, since the worklet scope has no fetch. Each processor owns one engine
 * instance id.
 *
 * This single-instantiation design is the core of the architecture: it avoids
 * WebKit recompiling the whole module on the audio thread (a ~500 MB
 * dirty-memory storm that crossed the iOS Jetsam limit in the previous
 * SharedArrayBuffer-based design).
 *
 * This file is bundled into a self-contained dist/engine/nam-worklet.js
 * (the Emscripten glue is inlined), so it can be served from any URL without
 * relative imports.
 */
import createNamEngine, { NamEngineModule } from './wasm/nam-engine.js';
import {
  NAM_PROCESSOR_NAME,
  NamModelInfo,
  NamWorkletRequest,
  NamWorkletResponse,
} from './protocol';

// Minimal AudioWorkletGlobalScope declarations (not in the TS dom lib).
declare const sampleRate: number;
declare function registerProcessor(
  name: string,
  ctor: new (options?: unknown) => unknown
): void;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor();
}

/** Frames per render quantum (fixed by the Web Audio spec). */
const RENDER_QUANTUM_FRAMES = 128;

/** After a model swap I fade back in over ~21 ms to mask the discontinuity. */
const FADE_IN_FRAMES = 1024;

// One wasm module per worklet scope, created on the first node's init.
let modulePromise: Promise<NamEngineModule> | null = null;

class NamProcessor extends AudioWorkletProcessor {
  private module: NamEngineModule | null = null;
  private instanceId = 0;
  private hasModel = false;
  private destroyed = false;

  // Cached view into the instance's wasm-side audio buffer. Re-derived when
  // memory growth replaces the underlying ArrayBuffer.
  private bufferPtr = 0;
  private bufferView: Float32Array | null = null;

  // Frames left in the post-model-swap fade-in.
  private fadeInRemaining = 0;

  constructor() {
    super();
    this.port.onmessage = (event: MessageEvent<NamWorkletRequest>) => {
      void this.handleRequest(event.data);
    };
  }

  private async handleRequest(request: NamWorkletRequest): Promise<void> {
    try {
      switch (request.type) {
        case 'init': {
          // locateFile short-circuits the glue's `new URL(...)` fallback for
          // the wasm path; Chromium's AudioWorkletGlobalScope has no URL
          // constructor (the path is never fetched, wasmBinary is given).
          modulePromise ??= createNamEngine({
            wasmBinary: request.wasmBytes,
            locateFile: (path: string) => path,
          });
          this.module = await modulePromise;
          this.instanceId = this.module._nam_createInstance(
            sampleRate,
            RENDER_QUANTUM_FRAMES
          );
          this.bufferPtr = this.module._nam_getBuffer(this.instanceId);
          this.respond(request.requestId);
          break;
        }
        case 'load-model': {
          const module = this.requireModule();
          const byteLength = module.lengthBytesUTF8(request.json) + 1;
          const ptr = module._malloc(byteLength);
          module.stringToUTF8(request.json, ptr, byteLength);
          const ok = module._nam_loadModel(
            this.instanceId,
            ptr,
            request.slimSize
          );
          module._free(ptr);
          if (!ok) {
            throw new Error(
              module.UTF8ToString(module._nam_getLastError()) ||
                'model load failed'
            );
          }
          // Loading may have grown wasm memory; the pointer is stable but the
          // view must be re-derived.
          this.bufferView = null;
          this.hasModel = true;
          this.fadeInRemaining = FADE_IN_FRAMES;
          this.respond(request.requestId, this.readModelInfo(module));
          break;
        }
        case 'unload-model': {
          this.requireModule()._nam_unloadModel(this.instanceId);
          this.hasModel = false;
          this.respond(request.requestId);
          break;
        }
        case 'set-slim-size': {
          this.requireModule()._nam_setSlimmableSize(
            this.instanceId,
            request.slimSize
          );
          this.fadeInRemaining = FADE_IN_FRAMES;
          this.respond(request.requestId);
          break;
        }
        case 'destroy': {
          if (this.module !== null && this.instanceId > 0) {
            this.module._nam_destroyInstance(this.instanceId);
          }
          this.instanceId = 0;
          this.hasModel = false;
          this.destroyed = true;
          this.respond(request.requestId);
          this.port.onmessage = null;
          break;
        }
      }
    } catch (error) {
      const message: NamWorkletResponse = {
        type: 'response',
        requestId: request.requestId,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
      this.port.postMessage(message);
    }
  }

  private requireModule(): NamEngineModule {
    if (this.module === null || this.instanceId <= 0) {
      throw new Error('worklet not initialized');
    }
    return this.module;
  }

  private respond(requestId: number, modelInfo?: NamModelInfo): void {
    const message: NamWorkletResponse = {
      type: 'response',
      requestId,
      ok: true,
      ...(modelInfo !== undefined ? { modelInfo } : {}),
    };
    this.port.postMessage(message);
  }

  private readModelInfo(module: NamEngineModule): NamModelInfo {
    const id = this.instanceId;
    const breakpointCount = module._nam_getSlimmableBreakpointCount(id);
    const slimmableBreakpoints: number[] = [];
    for (let i = 0; i < breakpointCount; i++) {
      slimmableBreakpoints.push(module._nam_getSlimmableBreakpoint(id, i));
    }
    return {
      slimmable: module._nam_isSlimmable(id) === 1,
      slimmableBreakpoints,
      hasLoudness: module._nam_hasLoudness(id) === 1,
      loudness: module._nam_getLoudness(id),
      expectedSampleRate: module._nam_getExpectedSampleRate(id),
    };
  }

  /** Get the wasm-side audio buffer, re-derived after memory growth. */
  private getBufferView(module: NamEngineModule): Float32Array {
    if (
      this.bufferView === null ||
      this.bufferView.buffer !== module.HEAPF32.buffer
    ) {
      const offset = this.bufferPtr >> 2;
      this.bufferView = module.HEAPF32.subarray(
        offset,
        offset + RENDER_QUANTUM_FRAMES
      );
    }
    return this.bufferView;
  }

  /**
   * Render one quantum. Allocation-free on the steady-state path: indexed
   * loops, no iterators, cached heap view (WebKit's worklet heap does not
   * collect garbage aggressively).
   */
  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    if (this.destroyed) return false;

    const input = inputs[0];
    const output = outputs[0];
    if (!output || output.length === 0) return true;
    const outputChannel = output[0];
    const inputChannel = input && input.length > 0 ? input[0] : null;
    const frames = outputChannel.length;

    if (
      this.module === null ||
      !this.hasModel ||
      inputChannel === null ||
      frames > RENDER_QUANTUM_FRAMES
    ) {
      // Pass-through (or silence when there is no input to pass).
      if (inputChannel !== null) {
        outputChannel.set(inputChannel);
      } else {
        outputChannel.fill(0);
      }
      return true;
    }

    const buffer = this.getBufferView(this.module);
    buffer.set(inputChannel);
    this.module._nam_process(this.instanceId, frames);
    // nam_process never allocates, so the view is still valid here.
    if (frames === RENDER_QUANTUM_FRAMES) {
      outputChannel.set(buffer);
    } else {
      for (let i = 0; i < frames; i++) outputChannel[i] = buffer[i];
    }

    if (this.fadeInRemaining > 0) {
      for (let i = 0; i < frames && this.fadeInRemaining > 0; i++) {
        const progress = 1 - this.fadeInRemaining / FADE_IN_FRAMES;
        outputChannel[i] *= progress;
        this.fadeInRemaining--;
      }
    }

    return true;
  }
}

registerProcessor(NAM_PROCESSOR_NAME, NamProcessor);
