import React, { useEffect, useRef } from 'react';
import { calculateLevels, scaleForDisplay } from '../../utils/metering';

const INNER_CIRCLE_SIZE = 16;
const RING_GAP = 2;
const RING_STROKE = 2;

interface MonitorButtonProps {
  isMonitoring: boolean;
  onClick: () => void;
  /** Drives the ring; pass `null` when idle. */
  analyserNode: AnalyserNode | null;
  size?: number;
  disabled?: boolean;
  /** Rendered inside the button after the LED, e.g. `LIVE | 🔇`. */
  trailing?: React.ReactNode;
}

/**
 * The Live-mode counterpart of PlayButton: a dot with a ring that breathes
 * with the input level while monitoring. Click to mute / unmute.
 */
export const MonitorButton: React.FC<MonitorButtonProps> = ({
  isMonitoring,
  onClick,
  analyserNode,
  size = 48,
  disabled = false,
  trailing,
}) => {
  const bufferRef = useRef<Float32Array>(new Float32Array(2048));
  const ringRef = useRef<SVGCircleElement>(null);

  const center = size / 2;
  const innerRadius = INNER_CIRCLE_SIZE / 2;
  const ringMinRadius = innerRadius + RING_GAP + RING_STROKE / 2;
  const ringMaxRadius = size / 2 - RING_STROKE / 2 - 1;

  // The ring follows the level at frame rate. It's written straight to the
  // SVG node: a React state update per frame would re-render the button
  // (and its trailing slot) 60×/s alongside the scope and meter loops, and
  // a CSS transition on `r` would keep chasing targets it never reaches.
  useEffect(() => {
    const ring = ringRef.current;
    if (!ring) return;
    if (!isMonitoring || !analyserNode) {
      ring.setAttribute('r', String(ringMinRadius));
      return;
    }
    let frame = 0;
    const buffer = bufferRef.current;
    const animate = () => {
      const levels = calculateLevels(analyserNode, buffer);
      const glow = scaleForDisplay(levels.rms);
      ring.setAttribute(
        'r',
        String(ringMinRadius + glow * (ringMaxRadius - ringMinRadius))
      );
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [isMonitoring, analyserNode, ringMinRadius, ringMaxRadius]);

  const color = isMonitoring ? 'var(--t3k-danger)' : 'var(--t3k-muted)';

  return (
    <button
      type='button'
      onClick={onClick}
      disabled={disabled}
      aria-label={isMonitoring ? 'Mute' : 'Unmute'}
      aria-pressed={isMonitoring}
      className={`monitor-button-reset-focus flex items-center gap-3 p-0 flex-shrink-0 disabled:cursor-not-allowed disabled:opacity-50 ${
        trailing ? 'rounded' : 'rounded-full'
      }`}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden='true'
        style={{ display: 'block', overflow: 'visible', flexShrink: 0 }}
      >
        <circle cx={center} cy={center} r={innerRadius} fill={color} />
        <circle
          ref={ringRef}
          cx={center}
          cy={center}
          r={ringMinRadius}
          fill='none'
          stroke={color}
          strokeWidth={RING_STROKE}
        />
      </svg>
      {trailing}
    </button>
  );
};
