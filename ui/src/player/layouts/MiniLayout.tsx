import React from 'react';
import { PlayerController } from '../hooks/usePlayer';
import { PlayButton } from '../parts/PlayButton';

export interface MiniLayoutProps {
  controller: PlayerController;
  status: 'ready' | 'loading' | 'disabled';
  size?: number;
}

/** A play/pause button and nothing else. Title (if any) is the aria label. */
export const MiniLayout: React.FC<MiniLayoutProps> = ({
  controller: c,
  status,
  size = 40,
}) => (
  <PlayButton
    size={size}
    isPlaying={c.isActive}
    isBusy={c.isBusy}
    disabled={status !== 'ready'}
    onClick={() => void c.togglePlay()}
    label={c.activeTone.meta?.title}
  />
);
