/**
 * Host-page script for TONE3000 player embeds. Built to `dist/embed.js` as a
 * dependency-free IIFE; tone3000.com serves it at `/embed.js`.
 *
 *   <iframe src="https://www.tone3000.com/embed/player?tones=123" data-t3k-player
 *           allow="autoplay; microphone; speaker-selection" …></iframe>
 *   <script async src="https://www.tone3000.com/embed.js"></script>
 *
 * It sizes each `iframe[data-t3k-player]` to the height the player reports,
 * tells the player a resizer is present (so it can offer expand/collapse),
 * and re-dispatches player events on the iframe element as `t3k:<type>`
 * CustomEvents for host analytics. Idempotent if included more than once.
 *
 * The host writes the `<iframe>` itself (so embeds work without JS and in
 * CMS blocks that strip scripts). A frame's permissions policy is fixed when
 * it navigates, so this script can't add `allow="microphone"` after the
 * fact; it warns instead when a frame is missing it and the player's
 * "Plug in and play" tab would be dead.
 */
import {
  EMBED_HOST_SOURCE,
  EMBED_PROTOCOL_VERSION,
  isEmbedMessage,
} from '../protocol';

const SELECTOR = 'iframe[data-t3k-player]';
const FLAG = '__t3kEmbedHost';

type Win = Window & { [FLAG]?: boolean };

(function install(win: Win) {
  if (win[FLAG]) return;
  win[FLAG] = true;

  const frames = new Set<HTMLIFrameElement>();

  const hello = (frame: HTMLIFrameElement) => {
    const target = frame.contentWindow;
    if (!target) return;
    const origin = originOf(frame.src);
    if (!origin) return;
    target.postMessage(
      { source: EMBED_HOST_SOURCE, v: EMBED_PROTOCOL_VERSION, type: 'hello' },
      origin
    );
  };

  const adopt = (frame: HTMLIFrameElement) => {
    if (frames.has(frame)) return;
    frames.add(frame);
    if (
      !/\bmicrophone\b/.test(frame.getAttribute('allow') ?? '') &&
      !/[?&]live=0\b/.test(frame.src)
    ) {
      console.warn(
        '[t3k] <iframe data-t3k-player> is missing allow="microphone"; ' +
          'the "Plug in and play" tab will not work. Add it, or pass ' +
          'live=0 in the player URL to hide the tab.',
        frame
      );
    }
    frame.addEventListener('load', () => hello(frame));
    // Already loaded before we got here.
    try {
      if (
        frame.contentWindow &&
        frame.contentDocument?.readyState === 'complete'
      )
        hello(frame);
    } catch {
      // Cross-origin: contentDocument throws; the load listener covers it.
      hello(frame);
    }
  };

  const scan = () => {
    document.querySelectorAll<HTMLIFrameElement>(SELECTOR).forEach(adopt);
  };

  win.addEventListener('message', (e: MessageEvent) => {
    if (!isEmbedMessage(e.data)) return;
    let frame: HTMLIFrameElement | undefined;
    frames.forEach(f => {
      if (f.contentWindow === e.source) frame = f;
    });
    if (!frame || e.origin !== originOf(frame.src)) return;

    const msg = e.data;
    if (msg.type === 'ready' || msg.type === 'resize') {
      frame.style.height = `${Math.max(0, Math.ceil(msg.height))}px`;
      if (msg.type === 'ready') {
        frame.dataset.t3kReady = 'true';
        // Answer `ready` too: the frame's listener may not have existed yet
        // when our `load`-time hello went out.
        hello(frame);
      }
    }
    frame.dispatchEvent(
      new CustomEvent(
        `t3k:${msg.type === 'event' ? msg.event.type : msg.type}`,
        {
          detail: msg.type === 'event' ? msg.event : { height: msg.height },
          bubbles: true,
        }
      )
    );
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scan, { once: true });
  } else {
    scan();
  }
  if (typeof MutationObserver !== 'undefined') {
    new MutationObserver(scan).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }
})(window as Win);

function originOf(url: string): string | null {
  try {
    return new URL(url, document.baseURI).origin;
  } catch {
    return null;
  }
}
