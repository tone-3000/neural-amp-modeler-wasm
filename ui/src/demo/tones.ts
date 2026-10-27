import { createElement } from 'react';
import {
  DEFAULT_INPUTS,
  DEFAULT_IRS,
  DEFAULT_MODELS,
  DEFAULT_REVERB_IRS,
} from '../constants';
import { NO_MODEL, PlayerAssets, PlayerTone } from '../types';

/**
 * Demo-app fixtures. Each bundled model becomes a "tone" the way a tone3000
 * tone would: one featured model, the shared IR and DI libraries.
 */

const SUBTITLES: Record<string, string> = {
  'Ampeg V-2': 'Bass Amp Capture',
};

/** Stand-in for tone3000's gear icon on its tinted square. */
const imageFallback = createElement(
  'div',
  {
    className:
      'w-full h-full flex items-center justify-center font-mono text-xs text-muted',
  },
  'NAM'
);

const assetsFor = (
  modelIndex: number,
  previewMode?: 'model' | 'ir'
): PlayerAssets => ({
  models: [{ ...DEFAULT_MODELS[modelIndex], default: true }],
  irs: DEFAULT_IRS,
  inputs: DEFAULT_INPUTS,
  previewMode,
});

/** `?slow` (or `?slow=<ms>`) on the preview / frame URL: lazy tones take
 * 8 s by default, so loading states (skeletons) can be inspected. */
const SLOW_MS = (() => {
  if (typeof window === 'undefined') return null;
  const v = new URLSearchParams(window.location.search).get('slow');
  if (v === null) return null;
  return Number(v) > 0 ? Number(v) : 8000;
})();

export const demoTone = (
  modelIndex: number,
  options: {
    lazy?: boolean;
    meta?: boolean;
    delayMs?: number;
    fail?: boolean;
  } = {}
): PlayerTone => {
  const model = DEFAULT_MODELS[modelIndex];
  const {
    lazy = false,
    meta = true,
    delayMs = SLOW_MS ?? 600,
    fail = false,
  } = options;
  return {
    id: `demo-${modelIndex}`,
    meta: meta
      ? {
          title: model.name,
          imageUrl: modelIndex % 2 === 0 ? '/screenshot.png' : undefined,
          imageFallback,
          href: 'https://www.tone3000.com',
          subtitle: SUBTITLES[model.name] ?? 'Amp Capture',
          format: 'nam',
          author: {
            name: 'tone3000',
            href: 'https://www.tone3000.com/tone3000',
            // Odd entries exercise the silhouette fallback.
            avatarUrl: modelIndex % 2 === 0 ? '/screenshot.png' : undefined,
            verified: true,
          },
        }
      : undefined,
    assets: lazy
      ? () =>
          new Promise<PlayerAssets>((resolve, reject) =>
            setTimeout(
              () =>
                fail
                  ? reject(new Error('Tone has no A2 models'))
                  : resolve(assetsFor(modelIndex)),
              delayMs
            )
          )
      : assetsFor(modelIndex),
  };
};

const author = {
  name: 'tone3000',
  href: 'https://www.tone3000.com/tone3000',
  verified: true,
};

/**
 * tone3000's gear matrix, as the player sees it. An IR pack of a "space":
 * the tone's IRs are the primary select, pinned to 50 % wet so the mix knob
 * sits beside the toggle, and an amp (or none) runs in front.
 */
export const spaceTone: PlayerTone = {
  id: 'demo-space',
  meta: {
    title: 'Room Pack',
    imageFallback,
    subtitle: 'Space IR',
    format: 'ir',
    author,
  },
  assets: {
    models: [
      NO_MODEL,
      ...DEFAULT_MODELS.map(m => ({
        ...m,
        default: m.name === 'Fender Deluxe Reverb',
      })),
    ],
    irs: DEFAULT_REVERB_IRS.slice(1).map((ir, i) => ({
      ...ir,
      mix: 0.5,
      default: i === 0,
    })) as PlayerAssets['irs'],
    inputs: DEFAULT_INPUTS,
    previewMode: 'ir',
    labels: { model: 'Amp' },
  },
};

/**
 * A cabinet capture: the tone's model stays the primary, and the companion
 * is an amp *ahead* of it (`preModels`) rather than an IR after it.
 */
const CAB_INDEX = DEFAULT_MODELS.findIndex(m => m.name === 'Ampeg V-2');

export const cabTone: PlayerTone = {
  id: 'demo-cab',
  meta: {
    title: 'Ampeg V-2 (as a cab capture)',
    imageFallback,
    subtitle: 'Cabinet Capture',
    format: 'nam',
    author,
  },
  assets: {
    models: [{ ...DEFAULT_MODELS[CAB_INDEX], default: true }],
    // "None" first and default: hear the capture alone until an amp is picked.
    preModels: [
      NO_MODEL,
      ...DEFAULT_MODELS.filter((_, i) => i !== CAB_INDEX).map(m => ({
        ...m,
        default: false,
      })),
    ],
    irs: [DEFAULT_IRS[0]],
    inputs: DEFAULT_INPUTS,
    labels: { preModel: 'Amp' },
  },
};

/** The whole library as one tone, like the v2 default player. */
export const libraryTone: PlayerTone = {
  id: 'library',
  meta: {
    title: 'TONE3000 demo library',
    subtitle: 'Every bundled model',
    format: 'nam',
  },
  assets: { models: DEFAULT_MODELS, irs: DEFAULT_IRS, inputs: DEFAULT_INPUTS },
};
