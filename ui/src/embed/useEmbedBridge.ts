import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlayerEvent } from '../types';
import {
  EMBED_PROTOCOL_VERSION,
  EMBED_SOURCE,
  EmbedMessage,
  isEmbedHostMessage,
} from './protocol';

export interface EmbedBridge {
  /** Pass to `T3kPlayer`'s `onEvent`. Forwards every event to the host. */
  onEvent: (event: PlayerEvent) => void;
  /**
   * `true` once the host script has said hello, `false` after the handshake
   * window closes without one (fixed-height host), `null` while waiting.
   * Use it to hide the expand toggle when the frame can't grow.
   */
  hostHasResizer: boolean | null;
  /**
   * Origin of the page that put this frame on it (`https://example.com`),
   * or `null` when it can't be told: not framed, or the page withholds its
   * referrer and runs no host script. The host script's hello is
   * authoritative; until it arrives this is the browser's own account.
   */
  hostOrigin: string | null;
}

const HANDSHAKE_TIMEOUT_MS = 750;

/**
 * The embedding page's origin without the host script: the ancestor chain
 * where the browser exposes it (not Firefox), else the referrer, which is
 * the embedding page unless it sends none.
 */
function guessHostOrigin(): string | null {
  const ancestor = window.location.ancestorOrigins?.[0];
  if (ancestor) return ancestor;
  try {
    return document.referrer ? new URL(document.referrer).origin : null;
  } catch {
    return null;
  }
}

/**
 * Iframe side of the embed protocol. Mount once on the page that renders the
 * embedded player and hand its `onEvent` to `T3kPlayer`.
 */
export function useEmbedBridge(options?: {
  /** Also receive the events locally (e.g. for analytics inside the frame). */
  onEvent?: (event: PlayerEvent) => void;
}): EmbedBridge {
  const localRef = useRef(options?.onEvent);
  localRef.current = options?.onEvent;

  const [hostHasResizer, setHostHasResizer] = useState<boolean | null>(null);
  const [hostOrigin, setHostOrigin] = useState<string | null>(null);
  const readySent = useRef(false);

  const post = useCallback((message: EmbedMessage) => {
    if (typeof window === 'undefined' || window.parent === window) return;
    // '*' is deliberate: embeds are public and the host origin is unknown.
    // The host script authenticates us by `event.source`.
    window.parent.postMessage(message, '*');
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || window.parent === window) return;
    setHostOrigin(prev => prev ?? guessHostOrigin());
    const timer = window.setTimeout(
      () => setHostHasResizer(prev => (prev === null ? false : prev)),
      HANDSHAKE_TIMEOUT_MS
    );
    const onMessage = (e: MessageEvent) => {
      if (e.source !== window.parent) return;
      if (isEmbedHostMessage(e.data) && e.data.type === 'hello') {
        setHostHasResizer(true);
        // A sandboxed parent reports the opaque origin "null": keep the guess.
        if (e.origin && e.origin !== 'null') setHostOrigin(e.origin);
      }
    };
    window.addEventListener('message', onMessage);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('message', onMessage);
    };
  }, []);

  const onEvent = useCallback(
    (event: PlayerEvent) => {
      localRef.current?.(event);
      // The player's `ready` has no height; the bridge's own `ready` (sent
      // with the first measured height, below) supersedes it for hosts.
      if (event.type === 'ready') return;
      if (event.type === 'resize') {
        if (!readySent.current) {
          readySent.current = true;
          post({
            source: EMBED_SOURCE,
            v: EMBED_PROTOCOL_VERSION,
            type: 'ready',
            height: event.height,
          });
        } else {
          post({
            source: EMBED_SOURCE,
            v: EMBED_PROTOCOL_VERSION,
            type: 'resize',
            height: event.height,
          });
        }
        return;
      }
      post({
        source: EMBED_SOURCE,
        v: EMBED_PROTOCOL_VERSION,
        type: 'event',
        event,
      });
    },
    [post]
  );

  return { onEvent, hostHasResizer, hostOrigin };
}
