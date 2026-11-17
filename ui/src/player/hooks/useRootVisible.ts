import { RefObject, useEffect, useRef } from 'react';

/** The usual viewability bar: half the element, for one continuous second. */
const RATIO = 0.5;
const DWELL_MS = 1000;

/**
 * Calls `onVisible` once, the first time at least half of the root element
 * has been on screen for a second with the tab in the foreground.
 *
 * Inside an iframe the observer still measures against the top-level
 * viewport, so an embed reports when the *host page* has scrolled it into
 * view, not merely when the frame loaded (lazy frames load well before that).
 */
export function useRootVisible(
  ref: RefObject<HTMLElement>,
  onVisible: (() => void) | undefined
) {
  const fired = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (
      !el ||
      !onVisible ||
      fired.current ||
      typeof IntersectionObserver === 'undefined'
    )
      return;

    let inView = false;
    let timer: number | undefined;
    const disarm = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = undefined;
    };
    // (Re)start the dwell clock whenever the element or the tab comes back.
    const arm = () => {
      disarm();
      if (!inView || document.visibilityState !== 'visible') return;
      timer = window.setTimeout(() => {
        fired.current = true;
        stop();
        onVisible();
      }, DWELL_MS);
    };
    const io = new IntersectionObserver(
      entries => {
        const entry = entries[entries.length - 1];
        inView = entry.isIntersecting && entry.intersectionRatio >= RATIO;
        arm();
      },
      { threshold: RATIO }
    );
    const stop = () => {
      disarm();
      io.disconnect();
      document.removeEventListener('visibilitychange', arm);
    };

    io.observe(el);
    document.addEventListener('visibilitychange', arm);
    return stop;
  }, [ref, onVisible]);
}
