import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { useT3kPlayerContext } from '../../context/T3kPlayerContext';
import {
  PlayerAssets,
  PlayerEvent,
  PlayerTone,
  PlayerView,
  PreviewMode,
  Selection,
  SourceMode,
  T3kPlayerProps,
  PlayerLayout,
} from '../../types';
import { initVisualizer, setupVisualizer } from '../../utils/visualizer';
import {
  AssetsStatus,
  createInitialState,
  playerReducer,
  seedSelection,
} from '../state/playerReducer';
import { LiveSetup, useLiveSetup } from './useLiveSetup';
import { usePlayerAssets } from './usePlayerAssets';

export interface SelectOption {
  label: string;
  value: string;
}

/** Captions for the controls, resolved from `assets.labels` + `previewMode`. */
export interface ControlLabels {
  /** The select that is the tone (model, or IR for IR packs). */
  primary: string;
  /** The companion select (cab / reverb for models, amp for IRs and cabs). */
  secondary: string;
  input: string;
}

/** Which asset list a select is bound to. */
export type SlotField = 'model' | 'ir' | 'preModel';

/** A select over one asset slot: options, current value, setter. */
export interface SlotControl {
  field: SlotField;
  options: SelectOption[];
  value: string;
  set: (value: string) => Promise<void>;
}

/** Everything a layout needs. Layouts are pure renderers over this. */
export interface PlayerController {
  playerId: string;
  tones: PlayerTone[];

  // Active tone
  activeToneId: string;
  activeIndex: number;
  activeTone: PlayerTone;
  activeAssets: AssetsStatus;
  selection: Selection | null;
  previewMode: PreviewMode;
  labels: ControlLabels;
  /** The select that is the tone. */
  primary: SlotControl;
  /** The one select shown beside it (see `PlayerAssets`). */
  companion: SlotControl;
  /** Wet/dry of the current IR, and whether it deserves a knob. */
  mix: { value: number; show: boolean; set: (mix: number) => void };

  // Playback
  isActive: boolean; // this player's active tone is what the engine is playing
  isTonePlaying: (toneId: string) => boolean;
  isBusy: boolean; // a play / switch is in flight
  busyToneId: string | null;
  currentTime: number;
  duration: number;
  error: string | null;

  // Panel state
  expanded: boolean;
  view: PlayerView;
  bypassed: boolean;
  sourceMode: SourceMode;
  live: LiveSetup;

  // Options for the selects
  modelOptions: SelectOption[];
  irOptions: SelectOption[];
  inputOptions: SelectOption[];
  preModelOptions: SelectOption[];

  // Actions
  togglePlay: (toneId?: string) => Promise<void>;
  activateTone: (toneId: string) => Promise<void>;
  step: (delta: 1 | -1) => Promise<void>;
  skipToStart: () => void;
  toggleBypass: () => void;
  setExpanded: (expanded: boolean) => void;
  setView: (view: PlayerView) => void;
  setModel: (url: string) => Promise<void>;
  setIr: (url: string) => Promise<void>;
  setInput: (url: string) => Promise<void>;
  setPreModel: (url: string) => Promise<void>;
  setSourceMode: (mode: SourceMode) => Promise<void>;
  prepareTone: (toneId: string) => Promise<void>; // resolve assets without playing

  // Refs for the waveform
  visualizerRef: React.RefObject<HTMLCanvasElement>;
  canvasWrapperRef: React.RefObject<HTMLDivElement>;
}

type Options = Pick<
  T3kPlayerProps,
  'tones' | 'id' | 'defaultToneId' | 'defaultExpanded' | 'slimSize' | 'onEvent'
> & { live: boolean; layout: PlayerLayout };

// Caption for a slot when it is the tone, and when it is the companion.
const DEFAULT_LABELS = {
  model: { primary: 'NAM Capture', companion: 'Amp' },
  ir: { primary: 'Impulse Response (IR)', companion: 'Cab' },
  preModel: { primary: 'Amp', companion: 'Amp' },
  input: 'Input',
} as const;

/** Select option value: a `null` url is the "None" entry. */
const optionValue = (url: string | null) => url ?? '';

export function usePlayer(options: Options): PlayerController {
  const { tones, slimSize, onEvent } = options;

  const generatedId = useId();
  const playerId = options.id ?? generatedId;
  const compositeId = useCallback(
    (toneId: string) => `${playerId}:${toneId}`,
    [playerId]
  );

  // ---- Events --------------------------------------------------------------
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const emit = useCallback((event: PlayerEvent) => {
    onEventRef.current?.(event);
  }, []);

  // ---- State ---------------------------------------------------------------
  const [state, dispatch] = useReducer(playerReducer, undefined, () =>
    createInitialState(tones, {
      defaultToneId: options.defaultToneId,
      defaultExpanded: options.defaultExpanded,
    })
  );
  const stateRef = useRef(state);
  stateRef.current = state;
  const { resolveAssets } = usePlayerAssets(tones, state, dispatch);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [busyToneId, setBusyToneId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ---- Context -------------------------------------------------------------
  const {
    audioState,
    audioInputDevices,
    getGraph,
    init,
    sync,
    loadAudio,
    setBypass,
    setIrMix,
    setPlaying,
    release,
    connectVisualizer,
    reconnectLiveInput,
    stopLiveInput,
  } = useT3kPlayerContext();
  const sourceMode: SourceMode = options.live ? state.sourceMode : 'demo';

  // ---- Derived -------------------------------------------------------------
  const activeIndex = Math.max(
    0,
    tones.findIndex(t => t.id === state.activeToneId)
  );
  const activeTone = tones[activeIndex];
  const activeToneId = activeTone.id;
  const activeAssets: AssetsStatus = state.assets[activeToneId] ?? {
    status: 'idle',
  };
  const selection = state.selection[activeToneId] ?? null;
  const assets = activeAssets.status === 'ready' ? activeAssets.value : null;
  const previewMode: PreviewMode = assets?.previewMode ?? 'model';
  // The chain is pre → model → ir. The tone is `previewMode`'s slot; the
  // companion is `preModels` when provided, else the other of model / ir.
  const primaryField: SlotField = previewMode;
  const companionField: SlotField = assets?.preModels
    ? 'preModel'
    : previewMode === 'ir'
      ? 'model'
      : 'ir';

  const labels = useMemo<ControlLabels>(() => {
    const l = assets?.labels ?? {};
    return {
      primary: l[primaryField] ?? DEFAULT_LABELS[primaryField].primary,
      secondary: l[companionField] ?? DEFAULT_LABELS[companionField].companion,
      input: l.input ?? DEFAULT_LABELS.input,
    };
  }, [assets, primaryField, companionField]);

  const isTonePlaying = useCallback(
    (toneId: string) => audioState.activePlayerId === compositeId(toneId),
    [audioState.activePlayerId, compositeId]
  );
  const isActive = isTonePlaying(activeToneId);
  const isAnyTonePlaying =
    audioState.activePlayerId?.startsWith(`${playerId}:`) ?? false;

  const toOptions = (items?: { name: string; url: string | null }[]) =>
    items?.map(i => ({ label: i.name, value: optionValue(i.url) })) ?? [];
  const modelOptions = useMemo(() => toOptions(assets?.models), [assets]);
  const irOptions = useMemo(() => toOptions(assets?.irs), [assets]);
  const inputOptions = useMemo(() => toOptions(assets?.inputs), [assets]);
  const preModelOptions = useMemo(() => toOptions(assets?.preModels), [assets]);

  // ---- Refs ----------------------------------------------------------------
  const visualizerRef = useRef<HTMLCanvasElement>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const activePlayerIdRef = useRef(audioState.activePlayerId);
  activePlayerIdRef.current = audioState.activePlayerId;

  // ---- Helpers -------------------------------------------------------------

  /** Assets + selection for a tone, resolving lazily. */
  const ensureTone = useCallback(
    async (
      toneId: string
    ): Promise<{ assets: PlayerAssets; selection: Selection }> => {
      const resolved = await resolveAssets(toneId);
      // The reducer seeds selection on `assets/ready`, but that dispatch may
      // not have rendered yet. Mirror its logic so callers never see null.
      const current = stateRef.current;
      const sel =
        current.selection[toneId] ??
        seedSelection(
          resolved,
          current.activeToneId !== toneId
            ? current.selection[current.activeToneId]
            : undefined
        );
      return { assets: resolved, selection: sel };
    },
    [resolveAssets]
  );

  const syncToEngine = useCallback(
    (sel: Selection) =>
      sync({
        modelUrl: sel.model.url,
        preModelUrl: sel.preModel?.url ?? null,
        slimSize,
        ir: sel.ir,
        mix: sel.mix,
        bypassed: stateRef.current.bypassed,
      }),
    [sync, slimSize]
  );

  const fail = useCallback(
    (
      code: Extract<PlayerEvent, { type: 'error' }>['code'],
      err: unknown,
      toneId?: string
    ) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[T3kPlayer] ${code}:`, err);
      setError(message);
      emit({ type: 'error', code, toneId, message });
    },
    [emit]
  );

  // ---- Effects -------------------------------------------------------------

  useEffect(() => {
    emit({ type: 'ready' });
  }, [emit]);

  // Only tear down playback if this player owns it; another player on the
  // page may be mid-song when a card scrolls out and unmounts.
  useEffect(() => {
    return () => {
      if (activePlayerIdRef.current?.startsWith(`${playerId}:`)) release();
    };
  }, [release, playerId]);

  // Keep the waveform canvas sized to its wrapper.
  const resizeCanvas = useCallback(() => {
    if (canvasWrapperRef.current && visualizerRef.current) {
      visualizerRef.current.width = canvasWrapperRef.current.clientWidth;
      initVisualizer({ canvas: visualizerRef.current });
    }
  }, []);
  useEffect(() => {
    resizeCanvas();
    const wrapper = canvasWrapperRef.current;
    if (!wrapper || typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', resizeCanvas);
      return () => window.removeEventListener('resize', resizeCanvas);
    }
    const ro = new ResizeObserver(resizeCanvas);
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, [resizeCanvas, sourceMode, state.expanded, state.view]);

  // Sync local bypass from the engine while this player drives it.
  useEffect(() => {
    if (isActive)
      dispatch({ type: 'bypass/set', bypassed: audioState.isBypassed });
  }, [isActive, audioState.isBypassed]);

  // Single source of `pause` / `ended`: whenever one of this player's tones
  // stops owning the engine — user pause, track end, another player or tone
  // taking over, source switch — emit exactly one event for it. Hosts and
  // embeds rely on play/pause pairing.
  const ownedToneRef = useRef<string | null>(null);
  const endedToneRef = useRef<string | null>(null);
  useEffect(() => {
    const owned = audioState.activePlayerId?.startsWith(`${playerId}:`)
      ? audioState.activePlayerId.slice(playerId.length + 1)
      : null;
    const previous = ownedToneRef.current;
    ownedToneRef.current = owned;
    if (previous && previous !== owned) {
      const ended = endedToneRef.current === previous;
      endedToneRef.current = null;
      emit({ type: ended ? 'ended' : 'pause', toneId: previous });
    }
  }, [audioState.activePlayerId, playerId, emit]);

  // Audio element listeners, only while this player's tone is active.
  useEffect(() => {
    if (!isActive) return;
    const element = getGraph()?.element;
    if (!element) return;

    const onTime = () => setCurrentTime(element.currentTime);
    const onEnded = () => {
      endedToneRef.current = activeToneId; // the ownership effect emits `ended`
    };
    const onMeta = () => setDuration(element.duration);
    if (element.duration) setDuration(element.duration);

    element.addEventListener('timeupdate', onTime);
    element.addEventListener('ended', onEnded);
    element.addEventListener('loadedmetadata', onMeta);
    return () => {
      element.removeEventListener('timeupdate', onTime);
      element.removeEventListener('ended', onEnded);
      element.removeEventListener('loadedmetadata', onMeta);
    };
  }, [getGraph, isActive, activeToneId]);

  // Waveform, only while active and the engine is ready.
  useEffect(() => {
    if (!isActive || audioState.initState !== 'ready') return;
    const graph = getGraph();
    if (!graph || !visualizerRef.current) return;
    const { analyser, stop } = setupVisualizer(
      visualizerRef.current,
      graph.context
    );
    const disconnect = connectVisualizer(analyser);
    return () => {
      stop();
      disconnect();
    };
  }, [
    audioState.initState,
    getGraph,
    connectVisualizer,
    isActive,
    sourceMode,
    state.expanded,
    state.view,
  ]);

  // ---- Playback ------------------------------------------------------------

  const startLive = useCallback(
    async (toneId: string, sel: Selection) => {
      await init();
      await reconnectLiveInput();
      await syncToEngine(sel);
      setPlaying(true, compositeId(toneId));
      const deviceId = getGraph()?.live?.deviceId;
      emit({
        type: 'play',
        mode: 'live',
        toneId,
        selection: sel,
        device:
          audioInputDevices.devices.find(d => d.deviceId === deviceId)?.label ??
          null,
      });
    },
    [
      init,
      reconnectLiveInput,
      syncToEngine,
      setPlaying,
      compositeId,
      getGraph,
      emit,
      audioInputDevices.devices,
    ]
  );

  const startDemo = useCallback(
    async (toneId: string, sel: Selection) => {
      await init();
      stopLiveInput();
      await loadAudio(sel.input.url);
      await syncToEngine(sel);
      setPlaying(true, compositeId(toneId));
      emit({ type: 'play', mode: 'demo', toneId, selection: sel });
    },
    [
      init,
      stopLiveInput,
      loadAudio,
      syncToEngine,
      setPlaying,
      compositeId,
      emit,
    ]
  );

  const togglePlay = useCallback(
    async (toneIdArg?: string) => {
      const toneId = toneIdArg ?? stateRef.current.activeToneId;
      if (isTonePlaying(toneId)) {
        setPlaying(false); // `pause` is emitted by the ownership effect
        return;
      }

      if (toneId !== stateRef.current.activeToneId) {
        dispatch({ type: 'tone/activate', toneId });
        emit({ type: 'tone_change', toneId });
      }

      setBusyToneId(toneId);
      setError(null);
      try {
        const { selection: sel } = await ensureTone(toneId);
        if (sourceMode === 'live') await startLive(toneId, sel);
        else await startDemo(toneId, sel);
      } catch (err) {
        setPlaying(false);
        fail('audio', err, toneId);
      } finally {
        setBusyToneId(null);
      }
    },
    [
      isTonePlaying,
      setPlaying,
      emit,
      ensureTone,
      sourceMode,
      startLive,
      startDemo,
      fail,
    ]
  );

  /** Make a tone active; if this player is mid-playback, switch audibly. */
  const activateTone = useCallback(
    async (toneId: string) => {
      if (toneId === stateRef.current.activeToneId) return;
      if (isAnyTonePlaying) {
        await togglePlay(toneId);
        return;
      }
      dispatch({ type: 'tone/activate', toneId });
      emit({ type: 'tone_change', toneId });
      try {
        await ensureTone(toneId);
      } catch (err) {
        fail('assets', err, toneId);
      }
    },
    [isAnyTonePlaying, togglePlay, emit, ensureTone, fail]
  );

  const step = useCallback(
    async (delta: 1 | -1) => {
      const index = tones.findIndex(
        t => t.id === stateRef.current.activeToneId
      );
      const next = tones[index + delta];
      if (next) await activateTone(next.id);
    },
    [tones, activateTone]
  );

  const prepareTone = useCallback(
    async (toneId: string) => {
      try {
        await ensureTone(toneId);
      } catch (err) {
        fail('assets', err, toneId);
      }
    },
    [ensureTone, fail]
  );

  const skipToStart = useCallback(() => {
    const element = getGraph()?.element;
    if (element) {
      element.currentTime = 0;
      setCurrentTime(0);
    }
  }, [getGraph]);

  // ---- Panel ---------------------------------------------------------------

  const toggleBypass = useCallback(() => {
    const bypassed = !stateRef.current.bypassed;
    dispatch({ type: 'bypass/set', bypassed });
    if (isActive) setBypass(bypassed);
    emit({ type: 'bypass_change', bypassed });
  }, [isActive, setBypass, emit]);

  const setExpanded = useCallback(
    (expanded: boolean) => {
      if (expanded === stateRef.current.expanded) return;
      dispatch({ type: 'expanded/set', expanded });
      emit({ type: expanded ? 'expand' : 'collapse' });
    },
    [emit]
  );

  // Whenever the controls are visible (always in `full`, when expanded in
  // `compact`) a lazy tone resolves so the selects aren't empty before play.
  const controlsVisible = options.layout === 'full' || state.expanded;
  useEffect(() => {
    if (controlsVisible && activeAssets.status === 'idle') {
      void prepareTone(activeToneId);
    }
  }, [controlsVisible, activeAssets.status, activeToneId, prepareTone]);

  const setView = useCallback(
    (view: PlayerView) => {
      if (view === stateRef.current.view) return;
      dispatch({ type: 'view/set', view });
      emit({ type: 'view_change', view });
    },
    [emit]
  );

  // ---- Selection -----------------------------------------------------------

  /** Apply a selection change: store it, announce it, and sync if we're live. */
  const select = useCallback(
    async (next: Selection, field: SlotField | 'input') => {
      const toneId = activeToneId;
      const value = next[field];
      dispatch({ type: 'selection/set', toneId, field, value } as never);
      emit({ type: 'selection_change', toneId, field, value } as PlayerEvent);
      if (!isActive) return;
      try {
        if (field === 'input') {
          await loadAudio(next.input.url);
          setPlaying(true, compositeId(toneId));
        } else {
          await syncToEngine(next);
        }
      } catch (err) {
        const code =
          field === 'input' ? 'audio' : field === 'ir' ? 'ir' : 'model';
        fail(code, err, toneId);
      }
    },
    [
      activeToneId,
      emit,
      isActive,
      loadAudio,
      setPlaying,
      compositeId,
      syncToEngine,
      fail,
    ]
  );

  const setModel = useCallback(
    async (url: string) => {
      const model = assets?.models.find(m => optionValue(m.url) === url);
      if (!model || !selection) return;
      await select({ ...selection, model }, 'model');
    },
    [assets, selection, select]
  );

  const setIr = useCallback(
    async (url: string) => {
      const ir = assets?.irs.find(i => optionValue(i.url) === url);
      if (!ir || !selection) return;
      // The reducer drops `mix` with the IR; mirror it for the sync below.
      const { mix: _mix, ...rest } = selection;
      await select({ ...rest, ir }, 'ir');
    },
    [assets, selection, select]
  );

  const setInput = useCallback(
    async (url: string) => {
      const input = assets?.inputs.find(i => i.url === url);
      if (!input || !selection) return;
      await select({ ...selection, input }, 'input');
    },
    [assets, selection, select]
  );

  const setPreModel = useCallback(
    async (url: string) => {
      const preModel = assets?.preModels?.find(m => optionValue(m.url) === url);
      if (!preModel || !selection) return;
      await select({ ...selection, preModel }, 'preModel');
    },
    [assets, selection, select]
  );

  // ---- Mix -----------------------------------------------------------------

  const setMix = useCallback(
    (mix: number) => {
      if (!selection) return;
      const toneId = activeToneId;
      dispatch({ type: 'selection/set', toneId, field: 'mix', value: mix });
      emit({ type: 'selection_change', toneId, field: 'mix', value: mix });
      if (isActive) setIrMix(mix);
    },
    [selection, activeToneId, emit, isActive, setIrMix]
  );

  // The engine knows the loaded IR's nature; before that, trust an explicit
  // `mix` and otherwise assume a cab (no knob) until it decodes.
  const engineHasIr = isActive && audioState.irUrl === selection?.ir.url;
  const mix = useMemo(() => {
    const ir = selection?.ir;
    const explicit = ir?.mix;
    const show =
      !!ir &&
      ir.url !== null &&
      (engineHasIr
        ? audioState.irReverbLike
        : explicit !== undefined && explicit < 1);
    const value =
      selection?.mix ??
      (engineHasIr ? audioState.irMix : (explicit ?? (show ? 0.5 : 1)));
    return { value, show, set: setMix };
  }, [
    selection,
    engineHasIr,
    audioState.irReverbLike,
    audioState.irMix,
    setMix,
  ]);

  const slotControl = useCallback(
    (field: SlotField): SlotControl => {
      switch (field) {
        case 'model':
          return {
            field,
            options: modelOptions,
            value: optionValue(selection?.model.url ?? null),
            set: setModel,
          };
        case 'ir':
          return {
            field,
            options: irOptions,
            value: optionValue(selection?.ir.url ?? null),
            set: setIr,
          };
        case 'preModel':
          return {
            field,
            options: preModelOptions,
            value: optionValue(selection?.preModel?.url ?? null),
            set: setPreModel,
          };
      }
    },
    [
      modelOptions,
      irOptions,
      preModelOptions,
      selection,
      setModel,
      setIr,
      setPreModel,
    ]
  );
  const primary = useMemo(
    () => slotControl(primaryField),
    [slotControl, primaryField]
  );
  const companion = useMemo(
    () => slotControl(companionField),
    [slotControl, companionField]
  );

  // ---- Source mode ---------------------------------------------------------

  const setSourceMode = useCallback(
    async (mode: SourceMode) => {
      if (mode === sourceMode) return;
      // Switching tabs stops this player's own playback; another player's
      // demo or monitoring is not ours to interrupt.
      if (isAnyTonePlaying) setPlaying(false);
      dispatch({ type: 'source/set', mode });
      emit({ type: 'source_change', mode });
      if (mode === 'live' && getGraph()) {
        try {
          await reconnectLiveInput();
        } catch (err) {
          fail('audio', err);
        }
      }
    },
    [
      sourceMode,
      isAnyTonePlaying,
      setPlaying,
      emit,
      getGraph,
      reconnectLiveInput,
      fail,
    ]
  );

  // Live setup (permission → interface) and auto-monitor once connected.
  const startMonitoring = useCallback(async () => {
    const toneId = stateRef.current.activeToneId;
    try {
      const { selection: sel } = await ensureTone(toneId);
      await startLive(toneId, sel);
    } catch (err) {
      fail('audio', err, toneId);
    }
  }, [ensureTone, startLive, fail]);

  const live = useLiveSetup({
    enabled: sourceMode === 'live',
    onConnected: startMonitoring,
  });

  return {
    playerId,
    tones,
    activeToneId,
    activeIndex,
    activeTone,
    activeAssets,
    selection,
    previewMode,
    labels,
    primary,
    companion,
    mix,

    isActive,
    isTonePlaying,
    isBusy: busyToneId !== null,
    busyToneId,
    currentTime,
    duration,
    error,

    expanded: state.expanded,
    view: state.view,
    bypassed: state.bypassed,
    sourceMode,
    live,

    modelOptions,
    irOptions,
    inputOptions,
    preModelOptions,

    togglePlay,
    activateTone,
    step,
    skipToStart,
    toggleBypass,
    setExpanded,
    setView,
    setModel,
    setIr,
    setInput,
    setPreModel,
    setSourceMode,
    prepareTone,

    visualizerRef,
    canvasWrapperRef,
  };
}
