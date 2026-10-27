import React from 'react';
import { Play } from '../../components/ui/Play';
import { Pause } from '../../components/ui/Pause';
import { CircularLoader } from '../../components/ui/CircularLoader';

interface PlayButtonProps {
  isPlaying: boolean;
  isBusy?: boolean;
  disabled?: boolean;
  size?: number;
  onClick: () => void;
  label?: string;
}

/** The one play/pause/loading affordance used by every layout and row. */
export const PlayButton: React.FC<PlayButtonProps> = ({
  isPlaying,
  isBusy = false,
  disabled = false,
  size = 48,
  onClick,
  label,
}) => (
  <button
    type='button'
    onClick={onClick}
    disabled={disabled}
    className='p-0 flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-fg rounded-full disabled:cursor-not-allowed disabled:opacity-50'
    aria-label={
      isPlaying
        ? `Pause${label ? ` ${label}` : ''}`
        : `Play${label ? ` ${label}` : ''}`
    }
    aria-pressed={isPlaying}
    style={{ width: size, height: size }}
  >
    {isPlaying ? (
      <Pause size={size} />
    ) : isBusy ? (
      <CircularLoader size={size} />
    ) : (
      <Play size={size} />
    )}
  </button>
);
