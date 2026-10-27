import type { PlayerEvent } from '../types';

/**
 * postMessage protocol between an embedded player (inside an iframe) and the
 * page hosting it. Shared by `useEmbedBridge` (iframe side) and the host
 * script (`embed.js`). Versioned so either side can evolve independently.
 */
export const EMBED_PROTOCOL_VERSION = 1 as const;

export const EMBED_SOURCE = 't3k-embed' as const;
export const EMBED_HOST_SOURCE = 't3k-embed-host' as const;

/** iframe → host */
export type EmbedMessage =
  | { source: typeof EMBED_SOURCE; v: 1; type: 'ready'; height: number }
  | { source: typeof EMBED_SOURCE; v: 1; type: 'resize'; height: number }
  | { source: typeof EMBED_SOURCE; v: 1; type: 'event'; event: PlayerEvent };

/** host → iframe */
export type EmbedHostMessage = {
  source: typeof EMBED_HOST_SOURCE;
  v: 1;
  type: 'hello';
};

export function isEmbedMessage(data: unknown): data is EmbedMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { source?: unknown }).source === EMBED_SOURCE &&
    (data as { v?: unknown }).v === EMBED_PROTOCOL_VERSION
  );
}

export function isEmbedHostMessage(data: unknown): data is EmbedHostMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { source?: unknown }).source === EMBED_HOST_SOURCE &&
    (data as { v?: unknown }).v === EMBED_PROTOCOL_VERSION
  );
}
