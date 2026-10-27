import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AudioGraph } from '../audio/AudioGraph';
import { announcePlayback, onOtherPlayback } from '../audio/playbackLock';
import type { NamEngineAssets } from '../engine';
import { useAudioDevicesAndPermissions } from '../hooks/useAudioDevicesAndPermissions';
import {
  AudioInputDevice,
  AudioInputDeviceState,
  AudioOutputDeviceState,
  AudioState,
  ChannelSelection,
  IR,
  MicrophonePermissionState,
  SourceMode,
} from '../types';

/**
 * One engine per provider, shared by every player beneath it.
 *
 * Nothing is created until `init()` runs from a user gesture: no
 * AudioContext, no wasm fetch, no model or IR download. Players call
 * `init()` then `sync()` with what they want to hear; the context diffs the
 * request against the graph and only loads what changed.
 */

export interface EngineSettings {
  modelUrl: string | null;
  /** Second NAM ahead of the model. Omit / `null` for pass-through. */
  preModelUrl?: string | null;
  slimSize?: number;
  ir: IR;
  /** Overrides `ir.mix` (and the length rule) when set. */
  mix?: number;
  bypassed: boolean;
}

export interface T3kPlayerContextType {
  audioState: AudioState;
  microphonePermission: MicrophonePermissionState;
  audioInputDevices: AudioInputDeviceState;
  audioOutputDevices: AudioOutputDeviceState;

  /**
   * Sample vs live, shared by every player under the provider: switching one
   * player to "Plug in and play" switches the page. `owner` is the player
   * that made the switch — the one that auto-connects and starts monitoring.
   */
  source: { mode: SourceMode; owner: string | null };
  setSourceMode: (mode: SourceMode, playerId: string) => void;

  /** The graph once `init()` has resolved. For meter and visualizer taps. */
  getGraph: () => AudioGraph | null;

  /** Create the engine (idempotent). Call from a user gesture. */
  init: () => Promise<AudioGraph>;
  /** Make the engine match `settings`, loading only what differs. */
  sync: (settings: EngineSettings) => Promise<void>;
  loadAudio: (url: string) => Promise<void>;
  setBypass: (bypassed: boolean) => void;
  /** Wet/dry of the loaded IR, live. */
  setIrMix: (mix: number) => void;
  /** Start (claiming the engine for `playerId`) or stop. */
  setPlaying: {
    (playing: true, playerId: string): void;
    (playing: false): void;
  };
  /** Stop and rewind. Called by a player that unmounts while it owns playback. */
  release: () => void;
  connectVisualizer: (analyser: AnalyserNode) => () => void;

  startLiveInput: (deviceId?: string) => Promise<void>;
  reconnectLiveInput: () => Promise<void>;
  stopLiveInput: () => void;
  selectLiveInputChannel: (channel: ChannelSelection) => void;
  setLiveInputGain: (gainDb: number) => void;

  requestMicrophonePermission: () => Promise<string | null>;
  refreshAudioInputDevices: () => Promise<{
    inputDevices: AudioInputDevice[];
    preferredDeviceId: string | null;
  }>;
  refreshAudioOutputDevices: () => Promise<void>;
  setOutputDevice: (deviceId: string | null) => Promise<void>;
}

const INITIAL_AUDIO_STATE: AudioState = {
  initState: 'uninitialized',
  isPlaying: false,
  activePlayerId: null,
  isBypassed: false,
  modelUrl: null,
  preModelUrl: null,
  irUrl: null,
  irMix: 1,
  irReverbLike: false,
  audioUrl: null,
  inputMode: { type: 'demo' },
  liveInputConfig: null,
};

const T3kPlayerContext = createContext<T3kPlayerContextType | null>(null);

export function T3kPlayerContextProvider({
  children,
  engineAssets,
}: {
  children: ReactNode;
  /**
   * Where to load the engine assets (nam-worklet.js, nam-engine.wasm) from.
   * Defaults to URLs relative to this package's module.
   */
  engineAssets?: NamEngineAssets;
}) {
  const [audioState, setAudioState] = useState<AudioState>(INITIAL_AUDIO_STATE);
  const [source, setSource] = useState<T3kPlayerContextType['source']>({
    mode: 'demo',
    owner: null,
  });
  const setSourceMode = useCallback((mode: SourceMode, playerId: string) => {
    setSource(prev => (prev.mode === mode ? prev : { mode, owner: playerId }));
  }, []);
  /** Last configured device, readable from callbacks without a stale closure. */
  const liveConfigRef = useRef(audioState.liveInputConfig);
  liveConfigRef.current = audioState.liveInputConfig;

  const graphRef = useRef<AudioGraph | null>(null);
  const initPromiseRef = useRef<Promise<AudioGraph> | null>(null);
  const engineAssetsRef = useRef(engineAssets);
  engineAssetsRef.current = engineAssets;

  const getGraph = useCallback(() => graphRef.current, []);

  const stopped = useCallback((): void => {
    setAudioState(prev =>
      prev.isPlaying || prev.activePlayerId
        ? { ...prev, isPlaying: false, activePlayerId: null }
        : prev
    );
  }, []);

  // ---- Playback ------------------------------------------------------------

  const setPlaying = useCallback(
    (playing: boolean, playerId?: string): void => {
      const graph = graphRef.current;
      if (!graph) {
        if (playing) console.warn('[T3kPlayer] setPlaying before init()');
        return;
      }
      if (playing) {
        announcePlayback();
        void graph.context.resume();
        if (!graph.live) {
          graph.element.play().catch(error => {
            console.error('[T3kPlayer] playback failed:', error);
            graph.setOutputEnabled(false);
            stopped();
          });
        }
        graph.setOutputEnabled(true);
        setAudioState(prev => ({
          ...prev,
          isPlaying: true,
          activePlayerId: playerId ?? prev.activePlayerId,
        }));
      } else {
        graph.setOutputEnabled(false);
        if (!graph.live) graph.element.pause();
        stopped();
      }
    },
    [stopped]
  ) as T3kPlayerContextType['setPlaying'];

  // Another engine on the page (other provider or same-origin iframe) started.
  useEffect(() => onOtherPlayback(() => setPlaying(false)), [setPlaying]);

  const release = useCallback((): void => {
    setPlaying(false);
    const graph = graphRef.current;
    if (graph) graph.element.currentTime = 0;
  }, [setPlaying]);

  // ---- Live input lifecycle hooks for the devices hook --------------------

  const dropLiveInput = useCallback((): void => {
    graphRef.current?.stopLive();
    setAudioState(prev => ({
      ...prev,
      inputMode: { type: 'demo' },
      liveInputConfig: null,
      isPlaying: false,
      activePlayerId: null,
    }));
  }, []);

  const {
    microphonePermission,
    audioInputDevices,
    audioOutputDevices,
    requestMicrophonePermission,
    refreshAudioInputDevices,
    refreshAudioOutputDevices,
    setOutputDevice,
    handleLiveInputUnavailable,
  } = useAudioDevicesAndPermissions({
    applyOutputRouting: useCallback(async (deviceId: string | null) => {
      await graphRef.current?.setSink(deviceId);
    }, []),
    onLiveInputLost: dropLiveInput,
    liveInputConfig: audioState.liveInputConfig,
  });

  // ---- Init ----------------------------------------------------------------

  const init = useCallback((): Promise<AudioGraph> => {
    if (graphRef.current) return Promise.resolve(graphRef.current);
    if (initPromiseRef.current) return initPromiseRef.current;

    setAudioState(prev => ({ ...prev, initState: 'initializing' }));
    const promise = AudioGraph.create(engineAssetsRef.current)
      .then(graph => {
        // Natural end of the demo clip: close the output and free the engine.
        graph.element.addEventListener('ended', () => {
          graph.setOutputEnabled(false);
          stopped();
        });
        graphRef.current = graph;
        setAudioState(prev => ({ ...prev, initState: 'ready' }));
        return graph;
      })
      .catch(error => {
        initPromiseRef.current = null;
        setAudioState(prev => ({ ...prev, initState: 'uninitialized' }));
        throw error;
      });
    initPromiseRef.current = promise;
    return promise;
  }, [stopped]);

  const requireGraph = useCallback((): AudioGraph => {
    const graph = graphRef.current;
    if (!graph) throw new Error('Audio engine not initialized. Call init().');
    return graph;
  }, []);

  // ---- Engine settings -----------------------------------------------------

  const sync = useCallback(
    async (settings: EngineSettings): Promise<void> => {
      const graph = requireGraph();
      const preModelUrl = settings.preModelUrl ?? null;
      if (graph.preModelUrl !== preModelUrl) {
        await graph.loadModel(preModelUrl, settings.slimSize, 'pre');
      }
      if (graph.modelUrl !== settings.modelUrl) {
        await graph.loadModel(settings.modelUrl, settings.slimSize);
      }
      if (graph.irUrl !== settings.ir.url) {
        await graph.setIr({
          url: settings.ir.url,
          mix: settings.mix ?? settings.ir.mix,
        });
      } else if (settings.mix !== undefined && graph.ir.mix !== settings.mix) {
        graph.setIrMix(settings.mix);
      }
      graph.setBypass(settings.bypassed);
      setAudioState(prev => ({
        ...prev,
        modelUrl: graph.modelUrl,
        preModelUrl: graph.preModelUrl,
        irUrl: graph.irUrl,
        irMix: graph.ir.mix,
        irReverbLike: graph.ir.reverbLike,
        isBypassed: graph.bypassed,
      }));
    },
    [requireGraph]
  );

  const setIrMix = useCallback((mix: number): void => {
    const graph = graphRef.current;
    if (!graph) return;
    graph.setIrMix(mix);
    setAudioState(prev => ({ ...prev, irMix: graph.ir.mix }));
  }, []);

  const loadAudio = useCallback(
    async (url: string): Promise<void> => {
      const graph = requireGraph();
      await graph.loadAudio(url);
      setAudioState(prev => ({ ...prev, audioUrl: graph.audioUrl }));
    },
    [requireGraph]
  );

  const setBypass = useCallback((bypassed: boolean): void => {
    const graph = graphRef.current;
    if (!graph) return;
    graph.setBypass(bypassed);
    setAudioState(prev => ({ ...prev, isBypassed: bypassed }));
  }, []);

  const connectVisualizer = useCallback(
    (analyser: AnalyserNode) =>
      graphRef.current?.connectVisualizer(analyser) ?? (() => {}),
    []
  );

  // ---- Live input ----------------------------------------------------------

  const startLiveInput = useCallback(
    async (deviceId?: string): Promise<void> => {
      const graph = requireGraph();
      // Taking the engine: whoever was playing stops.
      graph.element.pause();
      graph.setOutputEnabled(false);
      setAudioState(prev => ({
        ...prev,
        inputMode: { type: 'connecting' },
        isPlaying: false,
        activePlayerId: null,
      }));
      try {
        const previous = graph.live ?? liveConfigRef.current;
        const config = await graph.startLive(
          deviceId,
          previous
            ? { channel: previous.channel, gainsDb: previous.gainsDb }
            : {},
          () => handleLiveInputUnavailable('device-disconnected')
        );
        setAudioState(prev => ({
          ...prev,
          inputMode: { type: 'live' },
          liveInputConfig: config,
        }));
      } catch (error) {
        setAudioState(prev => ({ ...prev, inputMode: { type: 'demo' } }));
        throw error;
      }
    },
    [requireGraph, handleLiveInputUnavailable]
  );

  // The graph, not React state, says whether the input is live: this runs
  // right after startLiveInput() in the same tick, before state has settled.
  const reconnectLiveInput = useCallback(async (): Promise<void> => {
    const graph = graphRef.current;
    if (graph?.live) return;
    const config = liveConfigRef.current;
    if (!config) return;
    await startLiveInput(config.deviceId);
  }, [startLiveInput]);

  const stopLiveInput = useCallback((): void => {
    const graph = graphRef.current;
    if (!graph?.live) return;
    graph.stopLive();
    graph.setOutputEnabled(false);
    setAudioState(prev => ({
      ...prev,
      inputMode: { type: 'demo' },
      isPlaying: false,
      activePlayerId: null,
    }));
  }, []);

  const selectLiveInputChannel = useCallback(
    (channel: ChannelSelection): void => {
      const graph = graphRef.current;
      if (!graph?.live) return;
      graph.selectLiveChannel(channel);
      setAudioState(prev => ({ ...prev, liveInputConfig: graph.live }));
    },
    []
  );

  const setLiveInputGain = useCallback((gainDb: number): void => {
    const graph = graphRef.current;
    if (!graph?.live) return;
    graph.setLiveGainDb(gainDb);
    setAudioState(prev => ({ ...prev, liveInputConfig: graph.live }));
  }, []);

  // ---- Teardown ------------------------------------------------------------

  useEffect(() => {
    return () => {
      void graphRef.current?.dispose();
      graphRef.current = null;
      initPromiseRef.current = null;
    };
  }, []);

  const value = useMemo<T3kPlayerContextType>(
    () => ({
      audioState,
      microphonePermission,
      audioInputDevices,
      audioOutputDevices,
      source,
      setSourceMode,
      getGraph,
      init,
      sync,
      loadAudio,
      setBypass,
      setIrMix,
      setPlaying,
      release,
      connectVisualizer,
      startLiveInput,
      reconnectLiveInput,
      stopLiveInput,
      selectLiveInputChannel,
      setLiveInputGain,
      requestMicrophonePermission,
      refreshAudioInputDevices,
      refreshAudioOutputDevices,
      setOutputDevice,
    }),
    [
      audioState,
      microphonePermission,
      audioInputDevices,
      audioOutputDevices,
      source,
      setSourceMode,
      getGraph,
      init,
      sync,
      loadAudio,
      setBypass,
      setIrMix,
      setPlaying,
      release,
      connectVisualizer,
      startLiveInput,
      reconnectLiveInput,
      stopLiveInput,
      selectLiveInputChannel,
      setLiveInputGain,
      requestMicrophonePermission,
      refreshAudioInputDevices,
      refreshAudioOutputDevices,
      setOutputDevice,
    ]
  );

  return (
    <T3kPlayerContext.Provider value={value}>
      {children}
    </T3kPlayerContext.Provider>
  );
}

// SSR: a no-op context so server renders don't need a provider.
function createNoopContext(): T3kPlayerContextType {
  const noop = () => {};
  const resolve = async () => {};
  return {
    audioState: INITIAL_AUDIO_STATE,
    microphonePermission: { status: 'idle', error: null },
    audioInputDevices: {
      devices: [],
      isLoading: false,
      error: null,
      preferredDeviceId: null,
    },
    audioOutputDevices: { devices: [], selectedDeviceId: null },
    source: { mode: 'demo', owner: null },
    setSourceMode: noop,
    getGraph: () => null,
    init: () => Promise.reject(new Error('No audio on the server')),
    sync: resolve,
    loadAudio: resolve,
    setBypass: noop,
    setIrMix: noop,
    setPlaying: noop as T3kPlayerContextType['setPlaying'],
    release: noop,
    connectVisualizer: () => noop,
    startLiveInput: resolve,
    reconnectLiveInput: resolve,
    stopLiveInput: noop,
    selectLiveInputChannel: noop,
    setLiveInputGain: noop,
    requestMicrophonePermission: async () => null,
    refreshAudioInputDevices: async () => ({
      inputDevices: [],
      preferredDeviceId: null,
    }),
    refreshAudioOutputDevices: resolve,
    setOutputDevice: resolve,
  };
}

export function useT3kPlayerContext(): T3kPlayerContextType {
  const context = useContext(T3kPlayerContext);
  if (typeof window === 'undefined') return createNoopContext();
  if (!context) {
    throw new Error(
      'useT3kPlayerContext must be used within a T3kPlayerProvider'
    );
  }
  return context;
}
