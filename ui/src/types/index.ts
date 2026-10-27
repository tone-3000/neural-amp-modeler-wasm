import { ReactNode } from 'react';

/**
 * A NAM A2 model: a `.nam` file in the `SlimmableContainer` format, holding
 * one or more submodels at different sizes. The player loads nothing else.
 * Which submodel runs is chosen by `T3kPlayerProps.slimSize`.
 */
export interface Model {
  name: string;
  /** `null` is the explicit "no model" option: the slot passes through. */
  url: string | null;
  /** Selected first. Falls back to the first entry when none is marked. */
  default?: boolean;
}

/** The "no model" entry, for slots that should offer a pass-through. */
export const NO_MODEL: Model = { name: 'None', url: null };

/**
 * An impulse response. `url: null` is the explicit "no cabinet" option.
 * Level is not a property: every IR is gain-staged to unity in-band
 * response when it loads, so cabs and reverbs sit at the model's level.
 */
export interface IR {
  name: string;
  url: string | null;
  /**
   * Wet/dry mix in [0, 1]. Omit for the engine's rule (the one the TONE3000
   * plugin uses): IRs longer than a second are treated as reverbs and start
   * at 0.5, shorter ones as cabs at 1. Any IR that isn't fully wet shows a
   * mix knob in the controls.
   */
  mix?: number;
  default?: boolean;
}

/** A DI recording the demo plays through the model. */
export interface Input {
  name: string;
  url: string;
  default?: boolean;
}

/** The "no cabinet" IR, for asset lists that should offer a dry option. */
export const NO_IR: IR = { name: 'None', url: null, mix: 0 };

/** Which select is primary in the controls: the NAM model or the IR. */
export type PreviewMode = 'model' | 'ir';

// Source mode for players: 'demo' uses file playback, 'live' uses direct input
export type SourceMode = 'demo' | 'live';

/** Input channel of a multi-channel audio interface, 0-based. */
export type ChannelSelection = number;

// What audio source is currently active (connected to the audio engine)
export type InputMode =
  | { type: 'demo' }
  | { type: 'connecting' }
  | { type: 'live' };

/**
 * The configured live input. Kept after switching back to demo so the UI can
 * show the device and reconnect to it without asking again.
 */
export interface LiveInputConfig {
  deviceId: string;
  /** Channels the browser actually delivers for this device. */
  channelCount: number;
  channel: ChannelSelection;
  /** Input gain per channel, in dB (indexed by channel). */
  gainsDb: number[];
}

export interface AudioInputDevice {
  deviceId: string;
  label: string;
}

export interface AudioOutputDevice {
  deviceId: string;
  label: string;
}

// Microphone permission state (permission concerns only)
// - 'idle': not yet requested
// - 'pending': waiting for user response to browser prompt
// - 'granted': permission granted
// - 'denied': permission denied (can retry)
// - 'blocked': permanently blocked by browser (must reset in browser settings)
// - 'error': other error (device not found, in use, etc.)
export type MicrophonePermissionStatus =
  | 'idle'
  | 'pending'
  | 'granted'
  | 'denied'
  | 'blocked'
  | 'error';

export interface MicrophonePermissionState {
  status: MicrophonePermissionStatus;
  error: string | null;
}

// Audio input device state (device concerns only)
export interface AudioInputDeviceState {
  devices: AudioInputDevice[];
  isLoading: boolean;
  error: string | null;
  preferredDeviceId: string | null; // Device selected by user in browser permission dialog
}

// Audio output device state
export interface AudioOutputDeviceState {
  devices: AudioOutputDevice[];
  selectedDeviceId: string | null; // null means system default
}

/** Nothing is created or fetched until the first user gesture (`initializing`). */
export type AudioInitState = 'uninitialized' | 'initializing' | 'ready';

/** Engine state shared by every player under one provider. */
export interface AudioState {
  initState: AudioInitState;
  /** Demo playing or live monitoring. */
  isPlaying: boolean;
  /** `${playerId}:${toneId}` of the player driving the engine. */
  activePlayerId: string | null;
  isBypassed: boolean;
  modelUrl: string | null;
  preModelUrl: string | null;
  irUrl: string | null;
  /** Current wet/dry of the IR slot. */
  irMix: number;
  /** The loaded IR isn't meant to be fully wet (reverb, long tail). */
  irReverbLike: boolean;
  audioUrl: string | null;
  /** Which source feeds the engine right now. */
  inputMode: InputMode;
  liveInputConfig: LiveInputConfig | null;
}

export type NonEmptyArray<T> = [T, ...T[]];

// ---------------------------------------------------------------------------
// Player data contract (v3)
// ---------------------------------------------------------------------------

/**
 * Captions for the three selects. Defaults follow the tone3000 vocabulary:
 * the primary select is "NAM Capture" (or "Impulse Response (IR)" when
 * `previewMode` is `'ir'`), the paired one is "Cab" / "Amp", and the DI
 * track is "Input".
 */
export interface AssetLabels {
  model?: string;
  ir?: string;
  input?: string;
  /** Caption for the `preModels` select. Defaults to "Amp". */
  preModel?: string;
}

/**
 * Everything the engine needs to play a tone. May be resolved lazily.
 *
 * The chain is fixed: `input → preModels? → models → irs`. The tone fills
 * one slot (`previewMode`); the controls show exactly one companion select
 * next to it — `preModels` when given, otherwise the other of model / IR.
 */
export interface PlayerAssets {
  models: NonEmptyArray<Model>;
  irs: NonEmptyArray<IR>;
  inputs: NonEmptyArray<Input>;
  /**
   * A NAM in front of `models`: an amp driving a cabinet capture. When set
   * it becomes the companion select, so keep `irs` to one fixed entry
   * (usually `[NO_IR]`). Only meaningful with `previewMode: 'model'`.
   */
  preModels?: NonEmptyArray<Model>;
  /** Which select is primary. Defaults to `'model'`. */
  previewMode?: PreviewMode;
  labels?: AssetLabels;
}

/** Presentation data about a tone. Omit entirely to render a bare player. */
export interface ToneMeta {
  title: string;
  imageUrl?: string;
  /**
   * Fills the image square when there's no `imageUrl` — tone3000 passes its
   * gear icon on a tinted background. Defaults to a plain surface.
   */
  imageFallback?: ReactNode;
  /** Link for the title / image. Opens in a new tab when `linkTarget` is `_blank`. */
  href?: string;
  /** One line under the title, e.g. `'Amp Head Capture'`. Plain muted text. */
  subtitle?: string;
  /** File format, rendered as the TONE3000 pill (`'NAM'`, `'IR'`). */
  format?: string;
  author?: {
    name: string;
    /** Image, or the TONE3000 silhouette when absent. */
    avatarUrl?: string;
    href?: string;
    /** Shows the TONE3000 verified check after the name. */
    verified?: boolean;
  };
}

export interface PlayerTone {
  /** Stable and unique within one player. Also used as the React key. */
  id: string;
  meta?: ToneMeta;
  /** Eager assets, or a thunk that resolves them on first use. */
  assets: PlayerAssets | (() => Promise<PlayerAssets>);
}

/**
 * - `mini`: a play/pause button and nothing else.
 * - `compact`: playbar; controls collapsed behind a toggle. Full player minus
 *   the tone header (playlists keep a dense header for the pager).
 * - `full`: tone header + playbar + controls, always expanded.
 */
export type PlayerLayout = 'mini' | 'compact' | 'full';

/** Both themes ship as token sheets; `dark` is the default. */
export type PlayerTheme = 'dark' | 'light';

/** Which panel the body shows. `settings` is Live-only. */
export type PlayerView = 'controls' | 'settings';

/** The selections that fully describe what a tone is playing. */
export interface Selection {
  model: Model;
  ir: IR;
  input: Input;
  /** Only when the assets have `preModels`. */
  preModel?: Model;
  /** User-set wet/dry for `ir`, overriding its default. Cleared when `ir` changes. */
  mix?: number;
}

/**
 * Single event stream for every surface. Hosts subscribe once via `onEvent`;
 * the embed bridge forwards these verbatim to the parent page.
 */
export type PlayerEvent =
  | { type: 'ready' }
  | {
      type: 'play';
      mode: SourceMode;
      toneId: string;
      selection: Selection;
      /** Live mode only: configured device label. */
      device?: string | null;
    }
  | { type: 'pause'; toneId: string }
  | { type: 'ended'; toneId: string }
  | { type: 'tone_change'; toneId: string }
  | {
      type: 'selection_change';
      toneId: string;
      field: 'model';
      value: Model;
    }
  | { type: 'selection_change'; toneId: string; field: 'ir'; value: IR }
  | { type: 'selection_change'; toneId: string; field: 'input'; value: Input }
  | {
      type: 'selection_change';
      toneId: string;
      field: 'preModel';
      value: Model;
    }
  | { type: 'selection_change'; toneId: string; field: 'mix'; value: number }
  | { type: 'bypass_change'; bypassed: boolean }
  | { type: 'source_change'; mode: SourceMode }
  | { type: 'view_change'; view: PlayerView }
  | { type: 'expand' }
  | { type: 'collapse' }
  | { type: 'resize'; height: number }
  | {
      type: 'error';
      toneId?: string;
      code: 'assets' | 'model' | 'ir' | 'audio' | 'engine';
      message: string;
    };

export interface T3kPlayerProps {
  /** One tone renders the single-tone player; two or more render a playlist. */
  tones: NonEmptyArray<PlayerTone>;
  /** Defaults to `'full'`. Playlists do not support `'mini'`. */
  layout?: PlayerLayout;
  /** `compact` only: start expanded. */
  defaultExpanded?: boolean;
  /** Playlist only: which tone is active first. Defaults to the first tone. */
  defaultToneId?: string;
  /**
   * Show the Demo / Live source toggle. Set `false` where live input isn't
   * available (embeds, plugin webviews). Defaults to `true`.
   */
  live?: boolean;
  /**
   * Raw NAM-core slimmable size in [0.0, 1.0] applied to slimmable (A2)
   * models: NAM core selects the first submodel whose max_value is greater
   * than this value (e.g. with thresholds [0.5, 1.0], values below 0.5 select
   * the smaller submodel). Omit to run models at full size. Non-slimmable
   * models silently ignore it.
   */
  slimSize?: number;
  /** Render disabled. Pass an object to show a reason beside the controls. */
  disabled?: boolean | { reason?: string };
  /** Render the skeleton state. */
  isLoading?: boolean;
  /** Defaults to `'dark'`. */
  theme?: PlayerTheme;
  /** Rendered at the right end of the playbar (e.g. an info button). */
  headerSlot?: ReactNode;
  /** Show the "Powered by TONE3000" link. Defaults to `true`. */
  attribution?: boolean;
  /** `_blank` for embeds (default), `_self` for in-app. Applies to meta links. */
  linkTarget?: '_blank' | '_self';
  /**
   * `compact` / `full`: drop the top border and radius so the panel docks
   * flush under a host card (tone3000 search results).
   */
  docked?: boolean;
  /** `mini` only: button diameter in px. Defaults to 40. */
  size?: number;
  /** Stable id for this player instance. Generated when omitted. */
  id?: string;
  onEvent?: (event: PlayerEvent) => void;
}
