import React, { ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Skip } from '../../components/ui/Skip';
import { MonitorButton } from '../../components/ui/MonitorButton';
import { Mute, Unmute } from '../../components/ui/Mute';
import { useT3kPlayerContext } from '../../context/T3kPlayerContext';
import { formatTime } from '../../utils/player';
import { PlayButton } from './PlayButton';
import { PlayerController } from '../hooks/usePlayer';

/** The canvas is drawn 130px tall and cropped, top and bottom, to its row. */
const CANVAS_HEIGHT = 130;

const classes = (...names: (string | false | undefined)[]) =>
  names.filter(Boolean).join(' ');

interface PartProps {
  controller: PlayerController;
  disabled?: boolean;
}

/**
 * What starts and stops the sound. Demo: play, skip to start. Live: LED ·
 * LIVE | speaker, one button that mutes and unmutes the monitor.
 */
export const Transport: React.FC<
  PartProps & { /** Added to the skip button. */ skipClassName?: string }
> = ({ controller: c, disabled = false, skipClassName }) => {
  const { getGraph, audioState } = useT3kPlayerContext();
  const isLive = c.sourceMode === 'live';
  const isMonitoring = isLive && c.isActive;
  const engineReady = audioState.initState === 'ready';

  if (isLive) {
    return (
      <MonitorButton
        isMonitoring={isMonitoring}
        onClick={() => void c.togglePlay()}
        disabled={disabled || c.live.status !== 'ready'}
        analyserNode={
          isMonitoring && engineReady ? (getGraph()?.inputMeter ?? null) : null
        }
        size={48}
        trailing={
          <span className='flex items-center gap-3 sm:gap-4'>
            <span
              className={`hidden sm:block text-sm font-mono ${isMonitoring ? 'text-fg' : 'text-muted'}`}
            >
              LIVE
            </span>
            <span className='w-px h-10 bg-line' aria-hidden='true' />
            <span
              className={c.live.status === 'ready' ? 'text-fg' : 'text-muted'}
            >
              {isMonitoring ? <Unmute /> : <Mute />}
            </span>
          </span>
        }
      />
    );
  }

  return (
    <>
      <PlayButton
        isPlaying={c.isActive}
        isBusy={c.busyToneId === c.activeToneId}
        disabled={disabled}
        onClick={() => void c.togglePlay()}
      />
      <button
        type='button'
        onClick={c.skipToStart}
        disabled={disabled}
        className={classes(
          'p-0 flex-shrink-0 focus:outline-none disabled:cursor-not-allowed',
          skipClassName
        )}
        aria-label='Skip to start'
      >
        <Skip opacity={c.currentTime > 0 && !disabled ? 1 : 0.6} />
      </button>
    </>
  );
};

/** The waveform (Demo) or scope (Live), filling what the row has left. */
export const Waveform: React.FC<{
  controller: PlayerController;
  /** How much of the canvas shows, in px. */
  height: number;
  className?: string;
}> = ({ controller: c, height, className }) => {
  const crop = (height - CANVAS_HEIGHT) / 2;
  return (
    <div
      ref={c.canvasWrapperRef}
      className={classes('flex-1 min-w-0', className)}
    >
      <canvas
        ref={c.visualizerRef}
        height={CANVAS_HEIGHT}
        style={{
          marginBottom: crop,
          marginTop: crop,
          width: '100%',
          height: CANVAS_HEIGHT,
        }}
      />
    </div>
  );
};

/** `0:08 / 0:25`, Demo only. `className` decides when it shows. */
export const TimeReadout: React.FC<PartProps & { className: string }> = ({
  controller: c,
  disabled = false,
  className,
}) => (
  <div
    className={`${className} text-sm font-mono gap-1 text-muted tabular-nums ${disabled ? 'opacity-50' : ''}`}
  >
    <span>{formatTime(c.isActive ? c.currentTime : 0)}</span>
    <span>/</span>
    <span>{formatTime(c.isActive ? c.duration : 0)}</span>
  </div>
);

/** The chevron that opens and closes the controls. */
export const ExpandToggle: React.FC<PartProps & { className: string }> = ({
  controller: c,
  disabled = false,
  className,
}) => (
  <button
    type='button'
    onClick={() => c.setExpanded(!c.expanded)}
    disabled={disabled}
    className={className}
    aria-label={c.expanded ? 'Hide controls' : 'Show controls'}
    aria-expanded={c.expanded}
  >
    {c.expanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
  </button>
);

interface PlaybarProps extends PartProps {
  headerSlot?: ReactNode;
  /** `compact` layout: render the expand/collapse chevron. */
  expandToggle?: boolean;
}

/**
 * Transport + waveform. Demo: play, skip, waveform, time. Live: LED ·
 * LIVE | mute/unmute, scope. Same bar, same visualizer.
 */
export const Playbar: React.FC<PlaybarProps> = ({
  controller: c,
  disabled = false,
  headerSlot,
  expandToggle = false,
}) => (
  <div className='flex items-center gap-3 sm:gap-4 overflow-hidden w-full min-h-[80px]'>
    <Transport controller={c} disabled={disabled} />

    <Waveform controller={c} height={90} />

    {c.sourceMode !== 'live' && (
      <TimeReadout
        controller={c}
        disabled={disabled}
        className='hidden sm:flex'
      />
    )}

    {headerSlot}

    {expandToggle && (
      <ExpandToggle
        controller={c}
        disabled={disabled}
        className='p-0 flex-shrink-0 focus:outline-none text-fg disabled:cursor-not-allowed disabled:opacity-50'
      />
    )}
  </div>
);
