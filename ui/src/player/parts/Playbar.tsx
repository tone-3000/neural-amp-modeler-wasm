import React, { ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Skip } from '../../components/ui/Skip';
import { MonitorButton } from '../../components/ui/MonitorButton';
import { Mute, Unmute } from '../../components/ui/Mute';
import { useT3kPlayerContext } from '../../context/T3kPlayerContext';
import { formatTime } from '../../utils/player';
import { PlayButton } from './PlayButton';
import { PlayerController } from '../hooks/usePlayer';

const CANVAS_STYLE = {
  marginBottom: -20,
  marginTop: -20,
  width: '100%',
  height: '130px',
} as const;

interface PlaybarProps {
  controller: PlayerController;
  disabled?: boolean;
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
}) => {
  const { getGraph, audioState } = useT3kPlayerContext();
  const isLive = c.sourceMode === 'live';
  const isMonitoring = isLive && c.isActive;
  const engineReady = audioState.initState === 'ready';

  return (
    <div className='flex items-center gap-3 sm:gap-4 overflow-hidden w-full min-h-[80px]'>
      {isLive ? (
        <>
          {/* LED · LIVE | speaker — one button, the whole thing mutes/unmutes. */}
          <MonitorButton
            isMonitoring={isMonitoring}
            onClick={() => void c.togglePlay()}
            disabled={disabled || c.live.status !== 'ready'}
            analyserNode={
              isMonitoring && engineReady
                ? (getGraph()?.inputMeter ?? null)
                : null
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
                  className={
                    c.live.status === 'ready' ? 'text-fg' : 'text-muted'
                  }
                >
                  {isMonitoring ? <Unmute /> : <Mute />}
                </span>
              </span>
            }
          />
        </>
      ) : (
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
            className='p-0 flex-shrink-0 focus:outline-none disabled:cursor-not-allowed'
            aria-label='Skip to start'
          >
            <Skip opacity={c.currentTime > 0 && !disabled ? 1 : 0.6} />
          </button>
        </>
      )}

      <div ref={c.canvasWrapperRef} className='flex-1 min-w-0'>
        <canvas ref={c.visualizerRef} height={130} style={CANVAS_STYLE} />
      </div>

      {!isLive && (
        <div
          className={`hidden sm:flex text-sm font-mono gap-1 text-muted tabular-nums ${disabled ? 'opacity-50' : ''}`}
        >
          <span>{formatTime(c.isActive ? c.currentTime : 0)}</span>
          <span>/</span>
          <span>{formatTime(c.isActive ? c.duration : 0)}</span>
        </div>
      )}

      {headerSlot}

      {expandToggle && (
        <button
          type='button'
          onClick={() => c.setExpanded(!c.expanded)}
          disabled={disabled}
          className='p-0 flex-shrink-0 focus:outline-none text-fg disabled:cursor-not-allowed disabled:opacity-50'
          aria-label={c.expanded ? 'Hide controls' : 'Show controls'}
          aria-expanded={c.expanded}
        >
          {c.expanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
        </button>
      )}
    </div>
  );
};
