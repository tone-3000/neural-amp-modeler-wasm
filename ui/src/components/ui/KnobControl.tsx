import React, { useEffect, useRef, useState } from 'react';
import { KnobHeadless } from 'react-knob-headless';
import { KnobInner } from './KnobInner';

interface KnobControlProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  size?: number;
  labelSize?: number;
  labelBottom?: boolean;
  /** Keep the label for assistive tech only. */
  hideLabel?: boolean;
  isDisabled?: boolean;
  /**
   * Formatted value (`+2.0 dB`, `50%`) shown in a tip above the knob while
   * it's being dragged, and briefly after a wheel/keyboard change.
   */
  tip?: string;
}

/** How long the tip lingers after a non-drag change. */
const TIP_LINGER_MS = 900;

export const KnobControl: React.FC<KnobControlProps> = ({
  label,
  value,
  onChange,
  size = 64,
  labelSize = 14,
  labelBottom = true,
  hideLabel = false,
  isDisabled = false,
  tip,
}) => {
  // const angleDeg = value * 270 - 135; // -135..+135
  const knobRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [nudged, setNudged] = useState(false);
  const nudgeTimer = useRef<ReturnType<typeof setTimeout>>();
  // Set by the knob's own change callback, so only the user's wheel/key
  // turns flash the tip — not programmatic updates (a restored gain on
  // mount, a reset when the IR changes).
  const userChange = useRef(false);

  const handleChange = (next: number) => {
    userChange.current = true;
    onChange(next);
  };

  // A user change that isn't part of a drag (wheel, keys) flashes the tip.
  useEffect(() => {
    if (!userChange.current) return;
    userChange.current = false;
    if (dragging || !tip) return;
    setNudged(true);
    clearTimeout(nudgeTimer.current);
    nudgeTimer.current = setTimeout(() => setNudged(false), TIP_LINGER_MS);
    return () => clearTimeout(nudgeTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    const knobElement = knobRef.current;
    if (!knobElement) return;

    const preventSelection = (e: Event) => {
      e.preventDefault();
      return false;
    };

    const handleMouseDown = () => {
      setDragging(true);
      // Prevent text selection during drag
      const bodyStyle = document.body.style as any;
      bodyStyle.userSelect = 'none';
      bodyStyle.webkitUserSelect = 'none';
      bodyStyle.mozUserSelect = 'none';
      bodyStyle.msUserSelect = 'none';

      // Add class for CSS targeting
      document.body.classList.add('dragging');
    };

    const handleMouseUp = () => {
      setDragging(false);
      // Restore text selection
      const bodyStyle = document.body.style as any;
      bodyStyle.userSelect = '';
      bodyStyle.webkitUserSelect = '';
      bodyStyle.mozUserSelect = '';
      bodyStyle.msUserSelect = '';

      // Remove class
      document.body.classList.remove('dragging');
    };

    // Add event listeners
    knobElement.addEventListener('selectstart', preventSelection);
    knobElement.addEventListener('dragstart', preventSelection);
    knobElement.addEventListener('pointerdown', handleMouseDown);
    document.addEventListener('pointerup', handleMouseUp);
    document.addEventListener('pointercancel', handleMouseUp);

    return () => {
      // Cleanup
      knobElement.removeEventListener('selectstart', preventSelection);
      knobElement.removeEventListener('dragstart', preventSelection);
      knobElement.removeEventListener('pointerdown', handleMouseDown);
      document.removeEventListener('pointerup', handleMouseUp);
      document.removeEventListener('pointercancel', handleMouseUp);

      // Ensure body styles are reset
      const bodyStyle = document.body.style as any;
      bodyStyle.userSelect = '';
      bodyStyle.webkitUserSelect = '';
      bodyStyle.mozUserSelect = '';
      bodyStyle.msUserSelect = '';
      document.body.classList.remove('dragging');
    };
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: labelBottom ? 'column' : 'column-reverse',
        justifyContent: 'center',
        alignItems: 'center',
        gap: hideLabel ? 0 : labelSize === 14 ? '14px' : '10px',
      }}
    >
      <KnobHeadless
        ref={knobRef}
        aria-label={label}
        valueRaw={value}
        valueMin={0}
        valueMax={1}
        dragSensitivity={0.006}
        valueRawRoundFn={x => Math.round(x * 100) / 100}
        valueRawDisplayFn={x => `${x.toFixed(2)}`}
        onValueRawChange={handleChange}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        className='knob'
        style={{
          width: size,
          height: size,
          position: 'relative',
          userSelect: 'none',
          outline: 'none',
          boxShadow: 'none',
          WebkitTapHighlightColor: 'transparent',
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          pointerEvents: isDisabled ? 'none' : 'auto',
        }}
      >
        {/* New gradient knob design */}
        <KnobInner value={value} size={size} />
        {tip && (dragging || hovered || nudged) && (
          <span
            role='status'
            className='pointer-events-none absolute left-1/2 bottom-full mb-1.5 -translate-x-1/2 z-10 whitespace-nowrap rounded bg-surface border border-line px-1.5 py-0.5 font-mono text-xs text-fg tabular-nums shadow'
          >
            {tip}
          </span>
        )}
      </KnobHeadless>

      {!hideLabel && (
        <span
          style={{
            fontSize: labelSize,
            fontWeight: 400,
            textAlign: 'center',
            color: 'var(--t3k-fg)',
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
};
