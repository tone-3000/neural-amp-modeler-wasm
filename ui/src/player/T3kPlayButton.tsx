import React from 'react';
import { PlayerTheme } from '../types';
import { PlayButton } from './parts/PlayButton';

export interface T3kPlayButtonProps {
  isPlaying: boolean;
  /** Loading: the spinner takes the play icon's place. */
  isBusy?: boolean;
  disabled?: boolean;
  /** Diameter in px. Defaults to 40, the `mini` layout's size. */
  size?: number;
  /** Named in the accessible label: "Play <label>" / "Pause <label>". */
  label?: string;
  /** Defaults to `'dark'`. */
  theme?: PlayerTheme;
  onClick: () => void;
}

/**
 * The player's play / pause / loading button on its own, for a host that
 * keeps one player on the page and starts it from somewhere else: a button on
 * each card driving a pinned player through its `ref`.
 *
 * Unlike the `mini` layout it is not a player. It holds no state and needs no
 * provider; the host derives `isPlaying` and `isBusy` from the events of the
 * player it drives.
 */
export const T3kPlayButton: React.FC<T3kPlayButtonProps> = ({
  size = 40,
  theme = 'dark',
  ...button
}) => (
  <div
    className='neural-amp-modeler'
    data-layout='mini'
    data-theme={theme}
    style={{ display: 'inline-flex' }}
  >
    <PlayButton size={size} {...button} />
  </div>
);
