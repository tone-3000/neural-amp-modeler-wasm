import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  calculateLevels,
  clamp,
  levelToLogDisplay,
} from '../../utils/metering';

export interface InputMeterProps {
  /** AnalyserNode to read levels from */
  analyser: AnalyserNode | null;
  /** Number of blocks; by default as many 6px blocks as fit the width. */
  blockCount?: number;
  /** Additional CSS classes */
  className?: string;
  /** Label for accessibility */
  label?: string;
  /** Show meter in inactive/grayscale state - active blocks use grayscale instead of color gradient */
  inactive?: boolean;
}

const BLOCK_SIZE = 6;
const BLOCK_GAP = 3;
const INACTIVE_COLOR = 'var(--t3k-line)';

// As many square blocks as fit the width, so they never stretch.
function getBlockCountForWidth(width: number): number {
  return Math.max(
    4,
    Math.floor((width + BLOCK_GAP) / (BLOCK_SIZE + BLOCK_GAP))
  );
}

// Interpolate color along gradient: blue (left) → yellow (middle) → red (right)
const getGradientColor = (position: number): string => {
  let r: number, g: number, b: number;

  if (position <= 0.5) {
    const t = position * 2;
    r = Math.round(255 * t);
    g = Math.round(255 * t);
    b = Math.round(255 * (1 - t));
  } else {
    const t = (position - 0.5) * 2;
    r = 255;
    g = Math.round(255 * (1 - t));
    b = 0;
  }

  return `rgb(${r}, ${g}, ${b})`;
};

// Grayscale gradient for inactive state: dark (left) → light (right)
const getGrayscaleColor = (position: number): string => {
  const v = Math.round(90 + position * 100); // ~90 to ~190
  return `rgb(${v}, ${v}, ${v})`;
};

/**
 * A horizontal block-style audio level meter.
 *
 * Like DbMeter but horizontal: each block is active or inactive based on level.
 * Level 1 = full bar (all blocks active), level 0 = empty (all blocks inactive).
 *
 * Usage:
 * ```tsx
 * <InputMeter analyser={nodes.inputMeterNode} inactive={!isReady} />
 * ```
 */
export const InputMeter: React.FC<InputMeterProps> = ({
  analyser,
  blockCount: blockCountProp,
  className = '',
  label = 'Input level',
  inactive = false,
}) => {
  const [level, setLevel] = useState(0);
  const [blockCount, setBlockCount] = useState(12);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const isRunningRef = useRef(false);
  const bufferRef = useRef<Float32Array>(new Float32Array(2048));

  // Responsive block count from container width
  useEffect(() => {
    const el = containerRef.current;
    if (!el || blockCountProp !== undefined) return;

    const updateBlockCount = (width: number) =>
      setBlockCount(getBlockCountForWidth(width));

    updateBlockCount(el.getBoundingClientRect().width);

    const ro = new ResizeObserver(entries => {
      const { width } = entries[0]?.contentRect ?? { width: 0 };
      updateBlockCount(width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [blockCountProp]);

  const effectiveBlockCount = blockCountProp ?? blockCount;

  // Convert level (0-1) to last active block index; index <= activeBlockIndex means active
  // Use pseudo-log display so blocks fill left-to-right in a log-like manner
  const activeBlockIndex = useMemo(() => {
    const display = levelToLogDisplay(level);
    if (display <= 0) return -1;
    const idx = Math.floor(display * effectiveBlockCount) - 1;
    return Math.max(-1, Math.min(effectiveBlockCount - 1, idx));
  }, [level, effectiveBlockCount]);

  useEffect(() => {
    if (!analyser) {
      setLevel(0);
      return;
    }

    if (isRunningRef.current) return;
    isRunningRef.current = true;

    const updateMeter = () => {
      if (!isRunningRef.current) return;

      try {
        const levels = calculateLevels(analyser, bufferRef.current);
        // Use peak so block fill matches clip indicator (both use peak; RMS would show ~half when clipping)
        setLevel(clamp(levels.peak, 0, 1));
      } catch {
        // Silently handle errors
      }

      if (isRunningRef.current) {
        animationFrameRef.current = requestAnimationFrame(updateMeter);
      }
    };

    updateMeter();

    return () => {
      isRunningRef.current = false;
      if (animationFrameRef.current !== undefined) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = undefined;
      }
    };
  }, [analyser]);

  const blocks = useMemo(() => {
    return Array.from({ length: effectiveBlockCount }, (_, i) => i);
  }, [effectiveBlockCount]);

  return (
    <div
      ref={containerRef}
      className={`flex items-center flex-1 min-w-0 ${className}`}
      role='meter'
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(level * 100)}
    >
      {/* Blocks keep their size; the count adapts to the width (unless
          `blockCount` is fixed, in which case they spread evenly). */}
      <div
        className='flex flex-1 min-w-0'
        style={{
          gap: BLOCK_GAP,
          justifyContent:
            blockCountProp !== undefined ? 'space-between' : 'flex-start',
        }}
      >
        {blocks.map(index => {
          const isActive = index <= activeBlockIndex;
          const position =
            effectiveBlockCount > 1 ? index / (effectiveBlockCount - 1) : 0;
          const color = isActive
            ? inactive
              ? getGrayscaleColor(position)
              : getGradientColor(position)
            : INACTIVE_COLOR;

          return (
            <div
              key={index}
              style={{
                width: BLOCK_SIZE,
                height: BLOCK_SIZE,
                backgroundColor: color,
                flexShrink: 0,
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

InputMeter.displayName = 'InputMeter';
