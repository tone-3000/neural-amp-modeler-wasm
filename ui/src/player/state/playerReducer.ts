import {
  Input,
  IR,
  Model,
  PlayerAssets,
  PlayerTone,
  PlayerView,
  Selection,
} from '../../types';
import { getDefault } from '../../utils/player';

export type AssetsStatus =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; value: PlayerAssets }
  | { status: 'error'; message: string };

/**
 * Everything about a player that is not owned by the audio engine. One
 * reducer serves every layout and both cardinalities (single tone, playlist).
 */
export interface PlayerState {
  activeToneId: string;
  /** `compact` layout only. `full` pins it to true; `mini` ignores it. */
  expanded: boolean;
  /**
   * Which body the panel shows; `settings` is Live-only. (The Sample / Plug
   * in and play tab itself is page-wide and lives in the context.)
   */
  view: PlayerView;
  bypassed: boolean;
  assets: Record<string, AssetsStatus>;
  /** Per tone, seeded from its assets' defaults the first time they resolve. */
  selection: Record<string, Selection>;
  /**
   * Tones the user has been on. The first time a tone becomes active its
   * IR/input are re-seeded from the previous tone (preference carry-over);
   * after that it keeps its own choices.
   */
  visited: Record<string, true>;
  /** The tone that was active before the current one (carry-over source). */
  previousToneId: string | null;
}

/** Selection to carry preferences from when seeding `toneId`. */
function carryFrom(state: PlayerState, toneId: string): Selection | undefined {
  if (state.activeToneId !== toneId) return state.selection[state.activeToneId];
  if (state.previousToneId && state.previousToneId !== toneId) {
    return state.selection[state.previousToneId];
  }
  return undefined;
}

export type PlayerAction =
  | { type: 'tones/sync'; tones: PlayerTone[] }
  | { type: 'assets/loading'; toneId: string }
  | { type: 'assets/ready'; toneId: string; assets: PlayerAssets }
  | { type: 'assets/error'; toneId: string; message: string }
  | { type: 'tone/activate'; toneId: string }
  | { type: 'selection/set'; toneId: string; field: 'model'; value: Model }
  | { type: 'selection/set'; toneId: string; field: 'ir'; value: IR }
  | { type: 'selection/set'; toneId: string; field: 'input'; value: Input }
  | { type: 'selection/set'; toneId: string; field: 'preModel'; value: Model }
  | { type: 'selection/set'; toneId: string; field: 'mix'; value: number }
  | { type: 'bypass/set'; bypassed: boolean }
  | { type: 'expanded/set'; expanded: boolean }
  | { type: 'view/set'; view: PlayerView };

const statusFor = (tone: PlayerTone): AssetsStatus =>
  typeof tone.assets === 'function'
    ? { status: 'idle' }
    : { status: 'ready', value: tone.assets };

/**
 * Default selection for a set of assets. When `previous` is given (the
 * selection of the tone the user was just on), its IR, input and pre-model
 * carry over if the new assets contain the same URLs: those are user
 * preferences, the tone's own slot is the tone.
 */
export function seedSelection(
  assets: PlayerAssets,
  previous?: Selection
): Selection {
  const ir =
    (previous && assets.irs.find(i => i.url === previous.ir.url)) ||
    getDefault(assets.irs);
  const input =
    (previous && assets.inputs.find(i => i.url === previous.input.url)) ||
    getDefault(assets.inputs);
  const selection: Selection = { model: getDefault(assets.models), ir, input };
  if (assets.preModels) {
    selection.preModel =
      (previous?.preModel &&
        assets.preModels.find(m => m.url === previous.preModel!.url)) ||
      getDefault(assets.preModels);
  }
  return selection;
}

export function createInitialState(
  tones: PlayerTone[],
  options: { defaultToneId?: string; defaultExpanded?: boolean }
): PlayerState {
  const assets: Record<string, AssetsStatus> = {};
  const selection: Record<string, Selection> = {};
  for (const tone of tones) {
    const status = statusFor(tone);
    assets[tone.id] = status;
    if (status.status === 'ready') {
      selection[tone.id] = seedSelection(status.value);
    }
  }
  const activeToneId =
    options.defaultToneId && tones.some(t => t.id === options.defaultToneId)
      ? options.defaultToneId
      : tones[0].id;
  return {
    activeToneId,
    expanded: options.defaultExpanded ?? false,
    view: 'controls',
    bypassed: false,
    assets,
    selection,
    visited: { [activeToneId]: true },
    previousToneId: null,
  };
}

export function playerReducer(
  state: PlayerState,
  action: PlayerAction
): PlayerState {
  switch (action.type) {
    case 'tones/sync': {
      // Add tones that appeared, drop tones that left, keep everything else.
      const ids = new Set(action.tones.map(t => t.id));
      const assets: Record<string, AssetsStatus> = {};
      const selection: Record<string, Selection> = {};
      for (const tone of action.tones) {
        const existing = state.assets[tone.id];
        const status = existing ?? statusFor(tone);
        assets[tone.id] = status;
        if (state.selection[tone.id]) {
          selection[tone.id] = state.selection[tone.id];
        } else if (status.status === 'ready') {
          selection[tone.id] = seedSelection(status.value);
        }
      }
      const activeToneId = ids.has(state.activeToneId)
        ? state.activeToneId
        : action.tones[0].id;
      const previousToneId =
        state.previousToneId && ids.has(state.previousToneId)
          ? state.previousToneId
          : null;
      return {
        ...state,
        assets,
        selection,
        activeToneId,
        previousToneId,
        visited: { ...state.visited, [activeToneId]: true },
      };
    }

    case 'assets/loading':
      return {
        ...state,
        assets: { ...state.assets, [action.toneId]: { status: 'loading' } },
      };

    case 'assets/ready': {
      const previous = carryFrom(state, action.toneId);
      return {
        ...state,
        assets: {
          ...state.assets,
          [action.toneId]: { status: 'ready', value: action.assets },
        },
        selection: {
          ...state.selection,
          [action.toneId]:
            state.selection[action.toneId] ??
            seedSelection(action.assets, previous),
        },
      };
    }

    case 'assets/error':
      return {
        ...state,
        assets: {
          ...state.assets,
          [action.toneId]: { status: 'error', message: action.message },
        },
      };

    case 'tone/activate': {
      if (action.toneId === state.activeToneId) return state;
      const previous = state.selection[state.activeToneId];
      const next = state.assets[action.toneId];
      const selection = { ...state.selection };
      // First visit: re-seed with carry-over (eager tones were seeded with
      // plain defaults at init). Revisits keep the tone's own choices.
      if (next?.status === 'ready' && !state.visited[action.toneId]) {
        selection[action.toneId] = seedSelection(next.value, previous);
      }
      return {
        ...state,
        activeToneId: action.toneId,
        previousToneId: state.activeToneId,
        selection,
        visited: { ...state.visited, [action.toneId]: true },
      };
    }

    case 'selection/set': {
      const current = state.selection[action.toneId];
      if (!current) return state;
      const next: Selection = { ...current, [action.field]: action.value };
      // A user-set mix belongs to the IR it was set on.
      if (action.field === 'ir') delete next.mix;
      return {
        ...state,
        selection: { ...state.selection, [action.toneId]: next },
      };
    }

    case 'bypass/set':
      return state.bypassed === action.bypassed
        ? state
        : { ...state, bypassed: action.bypassed };

    case 'expanded/set':
      return state.expanded === action.expanded
        ? state
        : { ...state, expanded: action.expanded };

    case 'view/set':
      return state.view === action.view
        ? state
        : { ...state, view: action.view };
  }
}
