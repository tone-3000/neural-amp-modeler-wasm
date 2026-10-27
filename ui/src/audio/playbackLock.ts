/**
 * One thing plays at a time, across every player on the page.
 *
 * Inside one `T3kPlayerProvider` that is already true (one engine, one
 * `activePlayerId`). This extends it across providers and across same-origin
 * iframes (a blog post with five embeds): each engine announces when it
 * starts and stops itself when another one announces. Browsers without
 * BroadcastChannel simply don't coordinate.
 */

const CHANNEL = 't3k-player:playback';

interface Announcement {
  type: 'playing';
  from: string;
}

const instanceId =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

let channel: BroadcastChannel | null = null;
const listeners = new Set<() => void>();

function getChannel(): BroadcastChannel | null {
  if (channel) return channel;
  if (typeof BroadcastChannel === 'undefined') return null;
  channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = (event: MessageEvent<Announcement>) => {
    const data = event.data;
    if (data?.type !== 'playing' || data.from === instanceId) return;
    listeners.forEach(fn => fn());
  };
  return channel;
}

/** Tell other engines this one is about to play. */
export function announcePlayback(): void {
  getChannel()?.postMessage({ type: 'playing', from: instanceId });
}

/** Run `fn` when another engine starts playing. Returns an unsubscribe. */
export function onOtherPlayback(fn: () => void): () => void {
  getChannel();
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
