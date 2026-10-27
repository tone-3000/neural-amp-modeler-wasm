import { irInBandGainDb } from './irGain';

/**
 * Fetch-and-cache for the two kinds of assets the engine consumes: NAM model
 * files (JSON text) and impulse responses (decoded, with their gain staging
 * measured).
 *
 * Model text is cached per document; IRs per `BaseAudioContext` (a buffer
 * belongs to the context that decoded it). Failed fetches are evicted so a
 * retry re-fetches.
 */

export interface DecodedIr {
  buffer: AudioBuffer;
  /** Make-up gain for unity in-band response (see irGain.ts). */
  gainDb: number;
}

const modelText = new Map<string, Promise<string>>();
const irs = new WeakMap<BaseAudioContext, Map<string, Promise<DecodedIr>>>();

async function fetchOk(url: string, what: string): Promise<Response> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${what} (${response.status}): ${url}`);
  }
  return response;
}

/** Contents of a `.nam` file. */
export function fetchModelJson(url: string): Promise<string> {
  let promise = modelText.get(url);
  if (!promise) {
    promise = fetchOk(url, 'model').then(r => r.text());
    modelText.set(url, promise);
    promise.catch(() => modelText.delete(url));
  }
  return promise;
}

/** A decoded, gain-staged IR for `context`. */
export function fetchIr(
  context: BaseAudioContext,
  url: string
): Promise<DecodedIr> {
  let byUrl = irs.get(context);
  if (!byUrl) {
    byUrl = new Map();
    irs.set(context, byUrl);
  }
  let promise = byUrl.get(url);
  if (!promise) {
    promise = fetchOk(url, 'IR')
      .then(r => r.arrayBuffer())
      .then(bytes => context.decodeAudioData(bytes))
      .then(buffer => ({ buffer, gainDb: irInBandGainDb(buffer) }));
    byUrl.set(url, promise);
    promise.catch(() => byUrl!.delete(url));
  }
  return promise;
}

/** Load a URL into an `<audio>` element and wait until it can play. */
export function loadAudioElement(
  element: HTMLAudioElement,
  url: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = () => {
      element.removeEventListener('loadeddata', done);
      element.removeEventListener('error', fail);
      resolve();
    };
    const fail = () => {
      element.removeEventListener('loadeddata', done);
      element.removeEventListener('error', fail);
      reject(new Error(`Failed to load audio: ${url}`));
    };
    element.addEventListener('loadeddata', done);
    element.addEventListener('error', fail);
    element.src = url;
    element.load();
  });
}
