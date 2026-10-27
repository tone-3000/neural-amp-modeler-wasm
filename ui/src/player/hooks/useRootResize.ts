import { RefObject, useEffect } from 'react';

/**
 * Reports the root element's rendered height whenever it changes. Integer px,
 * deduped. This is what the embed bridge forwards to a host page so an iframe
 * can follow the player.
 *
 * No requestAnimationFrame here on purpose: ResizeObserver already batches
 * per layout pass, and browsers pause rAF in offscreen iframes, which would
 * hold back the height of an embed until it scrolled into view.
 */
export function useRootResize(
  ref: RefObject<HTMLElement>,
  onResize: ((height: number) => void) | undefined
) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !onResize || typeof ResizeObserver === 'undefined') return;

    let last = -1;
    const report = () => {
      const height = Math.ceil(el.getBoundingClientRect().height);
      if (height !== last) {
        last = height;
        onResize(height);
      }
    };
    const ro = new ResizeObserver(report);
    ro.observe(el);
    report();
    return () => ro.disconnect();
  }, [ref, onResize]);
}
