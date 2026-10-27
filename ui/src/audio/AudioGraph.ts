/**
 * The player's Web Audio graph, framework-free. One per `AudioContext`.
 *
 * The topology is fixed at construction and never rewired at runtime; every
 * state change (bypass, IR on/off, mix, source) is a gain ramp or a buffer
 * swap, which keeps switching click-free and the code free of connect /
 * disconnect bookkeeping:
 *
 *   element ──┐
 *   live ─────┴→ inputMeter ─┬→ preNam → nam ─┬→ convolver → irGain → wet ─┐
 *                            │                │   (irGain: unity in-band, measured on load)
 *                            │                └→ dry ───────────────────────┼→ processed ─┐
 *                            └→ bypass ─────────────────────────────────────────────────┼→ outputGain → outputMeter → sink
 *
 * `preNam` is a second NAM slot ahead of the tone's model (an amp driving a
 * cabinet capture). Both NAM nodes pass audio through while empty.
 *
 * Nothing here touches React. The context wraps this with state.
 */
import { NamEngine, NamEngineAssets, NamModelInfo, NamNode } from '../engine';
import { ChannelSelection, LiveInputConfig } from '../types';
import { needsMediaStreamWorkaround } from '../utils/browser';
import { fetchIr, fetchModelJson, loadAudioElement } from './assets';

export interface IrSettings {
  /** `null` = no cabinet (dry). */
  url: string | null;
  /**
   * Wet/dry mix in [0, 1]. Omit for the length rule: IRs over
   * `REVERB_SECONDS` long start at 0.5, shorter ones at 1.
   */
  mix?: number;
}

/** What the graph knows about the loaded IR. */
export interface IrStatus {
  url: string | null;
  mix: number;
  /**
   * Not meant to be fully wet: an explicit `mix` below 1, or no explicit mix
   * and a tail longer than `REVERB_SECONDS`. Drives the mix knob.
   */
  reverbLike: boolean;
}

/** The TONE3000 plugin's cab/reverb threshold. */
export const REVERB_SECONDS = 1;
const REVERB_DEFAULT_MIX = 0.5;

export type ModelSlot = 'main' | 'pre';

interface LiveNodes {
  stream: MediaStream;
  handleEnded: () => void;
  source: MediaStreamAudioSourceNode;
  gain: GainNode;
  splitter: ChannelSplitterNode;
  merger: ChannelMergerNode;
  meters: AnalyserNode[];
  state: LiveInputConfig;
}

const METER_FFT = 2048;
const RAMP_FAST = 0.005;
const RAMP = 0.01;
const RAMP_SLOW = 0.02;

export const dbToLinear = (db: number) => Math.pow(10, db / 20);

/** Most channels we ask the browser for on a live input. */
const MAX_LIVE_CHANNELS = 32;

export class AudioGraph {
  readonly inputMeter: AnalyserNode;
  readonly outputMeter: AnalyserNode;
  /** `<audio>` driving demo playback. Not attached to the DOM. */
  readonly element: HTMLAudioElement;

  private readonly elementSource: MediaElementAudioSourceNode;
  private readonly bypassGain: GainNode;
  private readonly processedGain: GainNode;
  private readonly convolver: ConvolverNode;
  private readonly irGain: GainNode;
  private readonly wetGain: GainNode;
  private readonly dryGain: GainNode;
  private readonly outputGain: GainNode;

  private sinkDestination: MediaStreamAudioDestinationNode | null = null;
  private sinkElement: HTMLAudioElement | null = null;

  private _live: LiveNodes | null = null;
  private outputEnabled = false;
  private disposed = false;

  modelUrl: string | null = null;
  preModelUrl: string | null = null;
  ir: IrStatus = { url: null, mix: 1, reverbLike: false };
  audioUrl: string | null = null;
  bypassed = false;

  get irUrl(): string | null {
    return this.ir.url;
  }

  private constructor(
    readonly context: AudioContext,
    readonly nam: NamNode,
    readonly preNam: NamNode
  ) {
    const c = context;
    this.element = new Audio();
    this.element.crossOrigin = 'anonymous';
    this.elementSource = c.createMediaElementSource(this.element);

    this.inputMeter = new AnalyserNode(c, { fftSize: METER_FFT });
    this.outputMeter = new AnalyserNode(c, { fftSize: METER_FFT });
    this.bypassGain = new GainNode(c, { gain: 0 });
    this.processedGain = new GainNode(c, { gain: 1 });
    // Gain staging is ours (unity in-band, see irGain.ts), not the browser's.
    this.convolver = new ConvolverNode(c, { disableNormalization: true });
    this.irGain = new GainNode(c, { gain: 1 });
    this.wetGain = new GainNode(c, { gain: 0 });
    this.dryGain = new GainNode(c, { gain: 1 });
    this.outputGain = new GainNode(c, { gain: 0 });

    this.elementSource.connect(this.inputMeter);
    this.inputMeter.connect(preNam);
    preNam.connect(nam);
    this.inputMeter.connect(this.bypassGain);
    nam.connect(this.convolver);
    this.convolver.connect(this.irGain);
    this.irGain.connect(this.wetGain);
    this.wetGain.connect(this.processedGain);
    nam.connect(this.dryGain);
    this.dryGain.connect(this.processedGain);
    this.processedGain.connect(this.outputGain);
    this.bypassGain.connect(this.outputGain);
    this.outputGain.connect(this.outputMeter);
    this.outputMeter.connect(c.destination);
  }

  /**
   * Create the context, load the wasm engine and build the graph. Call from
   * a user gesture: nothing is fetched before this.
   */
  static async create(assets?: NamEngineAssets): Promise<AudioGraph> {
    const context = new AudioContext({ latencyHint: 'interactive' });
    try {
      const engine = await NamEngine.attach(context, assets);
      const [nam, preNam] = await Promise.all([
        engine.createNode(),
        engine.createNode(),
      ]);
      return new AudioGraph(context, nam, preNam);
    } catch (error) {
      void context.close();
      throw error;
    }
  }

  get live(): LiveInputConfig | null {
    return this._live?.state ?? null;
  }

  /** Per-channel live meters (post-gain), or `null` when not live. */
  get liveMeters(): AnalyserNode[] | null {
    return this._live?.meters ?? null;
  }

  // ---- Models --------------------------------------------------------------

  /**
   * Fetch and load a NAM A2 model into a slot, or empty the slot (`null`)
   * so it passes through. Rendering through the node pauses while it parses
   * (100-300 ms); the output is dipped around the swap so the cut is
   * click-free.
   */
  async loadModel(
    url: string | null,
    slimSize?: number,
    slot: ModelSlot = 'main'
  ): Promise<NamModelInfo | null> {
    const node = slot === 'pre' ? this.preNam : this.nam;
    const setUrl = (value: string | null) => {
      if (slot === 'pre') this.preModelUrl = value;
      else this.modelUrl = value;
    };
    if (url === null) {
      const restore = this.dipOutput();
      try {
        await node.unloadModel();
        setUrl(null);
        return null;
      } finally {
        restore();
      }
    }
    const json = await fetchModelJson(url);
    const restore = this.dipOutput();
    try {
      const info = await node.loadModel(json, { slimSize });
      if (!info.slimmable) {
        await node.unloadModel();
        setUrl(null);
        throw new Error(
          `Not a NAM A2 model: ${url}. The player only loads SlimmableContainer (A2) files.`
        );
      }
      setUrl(url);
      return info;
    } finally {
      restore();
    }
  }

  // ---- IR ------------------------------------------------------------------

  async setIr(ir: IrSettings): Promise<void> {
    if (ir.url === null) {
      this.applyMix(0);
      this.convolver.buffer = null;
      this.ir = { url: null, mix: 1, reverbLike: false };
      return;
    }
    const { buffer, gainDb } = await fetchIr(this.context, ir.url);
    if (this.disposed) return;
    const reverbLike =
      ir.mix !== undefined ? ir.mix < 1 : buffer.duration > REVERB_SECONDS;
    const mix = ir.mix ?? (reverbLike ? REVERB_DEFAULT_MIX : 1);
    this.convolver.buffer = buffer;
    this.irGain.gain.setTargetAtTime(
      dbToLinear(gainDb),
      this.context.currentTime,
      RAMP
    );
    this.applyMix(mix);
    this.ir = { url: ir.url, mix, reverbLike };
  }

  /** Wet/dry of the loaded IR. No-op without one (dry is already 1). */
  setIrMix(mix: number): void {
    if (this.ir.url === null) return;
    const clamped = Math.max(0, Math.min(1, mix));
    this.applyMix(clamped);
    this.ir = { ...this.ir, mix: clamped };
  }

  private applyMix(mix: number): void {
    const t = this.context.currentTime;
    this.wetGain.gain.setTargetAtTime(mix, t, RAMP);
    this.dryGain.gain.setTargetAtTime(1 - mix, t, RAMP);
  }

  // ---- Bypass / output -----------------------------------------------------

  setBypass(bypassed: boolean): void {
    if (this.bypassed === bypassed) return;
    this.bypassed = bypassed;
    const t = this.context.currentTime;
    this.bypassGain.gain.setTargetAtTime(bypassed ? 1 : 0, t, RAMP_FAST);
    this.processedGain.gain.setTargetAtTime(bypassed ? 0 : 1, t, RAMP_FAST);
  }

  /** Open or close the output. Playback transport is separate (see `element`). */
  setOutputEnabled(enabled: boolean): void {
    this.outputEnabled = enabled;
    this.outputGain.gain.setTargetAtTime(
      enabled ? 1 : 0,
      this.context.currentTime,
      RAMP
    );
  }

  /** Dip the output for a model swap; returns the restore function. */
  private dipOutput(): () => void {
    if (!this.outputEnabled || this.context.state !== 'running') {
      return () => {};
    }
    this.outputGain.gain.setTargetAtTime(
      0,
      this.context.currentTime,
      RAMP_FAST
    );
    return () => {
      if (this.outputEnabled) {
        this.outputGain.gain.setTargetAtTime(1, this.context.currentTime, RAMP);
      }
    };
  }

  // ---- Demo source ---------------------------------------------------------

  async loadAudio(url: string): Promise<void> {
    if (this.audioUrl === url) return;
    await loadAudioElement(this.element, url);
    this.audioUrl = url;
  }

  // ---- Live source ---------------------------------------------------------

  /**
   * Replace the demo source with a live input. Resolves with the actual
   * device/channel configuration (the browser may clamp the request).
   */
  async startLive(
    deviceId: string | undefined,
    restore: Partial<Pick<LiveInputConfig, 'channel' | 'gainsDb'>>,
    onEnded: () => void
  ): Promise<LiveInputConfig> {
    this.stopLive();
    // Ask for every channel the interface has; the browser clamps to what it
    // supports (Chrome and Safari usually stop at 2, Firefox hands over the
    // device's channels) and `getSettings()` says what we got.
    const constraints: MediaTrackConstraints = {
      channelCount: { ideal: MAX_LIVE_CHANNELS },
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    };
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...constraints,
          deviceId: deviceId ? { exact: deviceId } : undefined,
        },
      });
    } catch (error) {
      if (
        deviceId &&
        error instanceof DOMException &&
        error.name === 'OverconstrainedError'
      ) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: constraints,
        });
      } else {
        throw error;
      }
    }
    if (this.disposed) {
      stream.getTracks().forEach(t => t.stop());
      throw new Error('AudioGraph disposed');
    }

    const track = stream.getAudioTracks()[0];
    const settings = track.getSettings();
    const channelCount = settings.channelCount ?? 1;
    const gainsDb = Array.from(
      { length: channelCount },
      (_, i) => restore.gainsDb?.[i] ?? 0
    );
    const channel: ChannelSelection =
      restore.channel !== undefined && restore.channel < channelCount
        ? restore.channel
        : 0;
    // Only a device that goes away is "ended"; our own stopLive() detaches
    // this before stopping the track.
    const handleEnded = () => {
      if (this._live?.stream === stream) onEnded();
    };
    track.addEventListener('ended', handleEnded);

    const c = this.context;
    const source = c.createMediaStreamSource(stream);
    const gain = new GainNode(c, { gain: dbToLinear(gainsDb[channel]) });
    const splitter = c.createChannelSplitter(channelCount);
    const merger = c.createChannelMerger(1);
    const meters = Array.from(
      { length: channelCount },
      () => new AnalyserNode(c, { fftSize: METER_FFT })
    );

    source.connect(gain);
    gain.connect(splitter);
    meters.forEach((meter, i) => splitter.connect(meter, i));
    splitter.connect(merger, channel, 0);
    merger.connect(this.inputMeter);
    this.elementSource.disconnect(this.inputMeter);

    this._live = {
      stream,
      handleEnded,
      source,
      gain,
      splitter,
      merger,
      meters,
      state: {
        deviceId: settings.deviceId ?? deviceId ?? '',
        channelCount,
        channel,
        gainsDb,
      },
    };
    if (c.state === 'suspended') await c.resume();
    // Re-apply the sink: changing sources resets the workaround element.
    await this.setSink(this.sinkId);
    return this._live.state;
  }

  /** Tear down the live input and restore the demo source. */
  stopLive(): void {
    const live = this._live;
    if (!live) return;
    this._live = null;
    live.stream.getTracks().forEach(t => {
      t.removeEventListener('ended', live.handleEnded);
      t.stop();
    });
    live.source.disconnect();
    live.gain.disconnect();
    live.splitter.disconnect();
    live.merger.disconnect();
    live.meters.forEach(m => m.disconnect());
    this.elementSource.connect(this.inputMeter);
  }

  selectLiveChannel(channel: ChannelSelection): void {
    const live = this._live;
    if (!live || channel < 0 || channel >= live.state.channelCount) return;
    live.splitter.disconnect(live.merger);
    live.splitter.connect(live.merger, channel, 0);
    live.state = { ...live.state, channel };
    live.gain.gain.setTargetAtTime(
      dbToLinear(live.state.gainsDb[channel]),
      this.context.currentTime,
      RAMP_SLOW
    );
  }

  /** Gain for the selected live channel, remembered per channel. */
  setLiveGainDb(gainDb: number): void {
    const live = this._live;
    if (!live) return;
    const gainsDb = [...live.state.gainsDb];
    gainsDb[live.state.channel] = gainDb;
    live.state = { ...live.state, gainsDb };
    live.gain.gain.setTargetAtTime(
      dbToLinear(gainDb),
      this.context.currentTime,
      RAMP_SLOW
    );
  }

  // ---- Output device -------------------------------------------------------

  private sinkId: string | null = null;

  /**
   * Route the output to a device (`null` = system default). Chromium uses
   * `AudioContext.setSinkId`; Firefox/Safari go through a
   * MediaStreamDestination + `<audio>` element.
   */
  async setSink(deviceId: string | null): Promise<void> {
    this.sinkId = deviceId;
    if (!needsMediaStreamWorkaround) {
      const ctx = this.context as AudioContext & {
        setSinkId?: (id: string) => Promise<void>;
      };
      if (typeof ctx.setSinkId === 'function') {
        await ctx.setSinkId(deviceId ?? '');
      }
      return;
    }

    if (this.sinkElement) {
      this.sinkElement.pause();
      this.sinkElement.srcObject = null;
      this.sinkElement = null;
    }
    if (this.sinkDestination) {
      this.sinkDestination.disconnect();
      this.sinkDestination = null;
    }
    this.outputMeter.disconnect();
    if (!deviceId) {
      this.outputMeter.connect(this.context.destination);
      return;
    }
    const destination = this.context.createMediaStreamDestination();
    this.outputMeter.connect(destination);
    const element = new Audio();
    element.srcObject = destination.stream;
    const sinkable = element as HTMLAudioElement & {
      setSinkId?: (id: string) => Promise<void>;
    };
    if (typeof sinkable.setSinkId === 'function') {
      await sinkable.setSinkId(deviceId);
    }
    this.sinkDestination = destination;
    this.sinkElement = element;
    await element.play();
  }

  // ---- Taps ----------------------------------------------------------------

  /** Tap the output (pre-meter) for a visualizer. Returns a disconnect. */
  connectVisualizer(analyser: AnalyserNode): () => void {
    this.outputGain.connect(analyser);
    return () => {
      try {
        this.outputGain.disconnect(analyser);
      } catch {
        // already disconnected
      }
    };
  }

  // ---- Lifecycle -----------------------------------------------------------

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.stopLive();
    this.element.pause();
    this.element.removeAttribute('src');
    this.sinkElement?.pause();
    await Promise.all([this.nam.dispose(), this.preNam.dispose()]);
    if (this.context.state !== 'closed') await this.context.close();
  }
}
