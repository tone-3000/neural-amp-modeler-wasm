import './index.css';

// Player
export { T3kPlayer } from './player/T3kPlayer';
export { T3kPlayerProvider } from './context/T3kPlayerProvider';
export {
  T3kPlayerContextProvider,
  useT3kPlayerContext,
} from './context/T3kPlayerContext';
export type { PlayerController } from './player/hooks/usePlayer';
export type { LiveSetup, LiveStatus } from './player/hooks/useLiveSetup';

// Audio graph (for hosts that drive the engine without the React player)
export { AudioGraph, type IrSettings } from './audio/AudioGraph';
export { irInBandGainDb } from './audio/irGain';

// Data contract
export { NO_IR, NO_MODEL } from './types';
export type {
  T3kPlayerProps,
  PlayerTone,
  PlayerAssets,
  ToneMeta,
  PlayerLayout,
  PlayerTheme,
  PlayerView,
  PlayerEvent,
  PreviewMode,
  AssetLabels,
  Selection,
  SourceMode,
  Model,
  IR,
  Input,
  LiveInputConfig,
  ChannelSelection,
  NonEmptyArray,
  AudioInputDevice,
  InputMode,
  MicrophonePermissionStatus,
  MicrophonePermissionState,
  AudioInputDeviceState,
} from './types';

// Demo content
export {
  DEFAULT_MODELS,
  DEFAULT_IRS,
  DEFAULT_CAB_IRS,
  DEFAULT_REVERB_IRS,
  DEFAULT_INPUTS,
} from './constants';

// Embed bridge (iframe side). The host script is `neural-amp-modeler-wasm/embed.js`.
export { useEmbedBridge, type EmbedBridge } from './embed/useEmbedBridge';
export {
  EMBED_PROTOCOL_VERSION,
  isEmbedMessage,
  isEmbedHostMessage,
  type EmbedMessage,
  type EmbedHostMessage,
} from './embed/protocol';

// Engine
export {
  NamEngine,
  NamNode,
  NamNodePool,
  type NamEngineAssets,
  type NamLoadOptions,
  type NamModelInfo,
} from './engine';
