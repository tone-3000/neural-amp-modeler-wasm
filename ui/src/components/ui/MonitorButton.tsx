import React, { useEffect, useRef, useState } from 'react';
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

  const center = size / 2;
  const innerRadius = INNER_CIRCLE_SIZE / 2;
  const ringMinRadius = innerRadius + RING_GAP + RING_STROKE / 2;
  const ringMaxRadius = size / 2 - RING_STROKE / 2 - 1;
  const [ringRadius, setRingRadius] = useState(ringMinRadius);

  useEffect(() => {
    if (!isMonitoring || !analyserNode) {
      setRingRadius(ringMinRadius);
      return;
    }
    let running = true;
    const buffer = bufferRef.current;
    const animate = () => {
      if (!running) return;
      const levels = calculateLevels(analyserNode, buffer);
      const glow = scaleForDisplay(levels.rms);
      setRingRadius(ringMinRadius + glow * (ringMaxRadius - ringMinRadius));
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
    return () => {
      running = false;
    };
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
          cx={center}
          cy={center}
          r={ringRadius}
          fill='none'
          stroke={color}
          strokeWidth={RING_STROKE}
          className='transition-[r] duration-75'
        />
      </svg>
      {trailing}
    </button>
  );
};
