import React from 'react';
import { X } from 'lucide-react';

interface CloseButtonProps {
  onClick: () => void;
  /** Glyph size in px. */
  size?: number;
  /** The button's box; the colours and focus ring are the part's own. */
  className?: string;
}

/**
 * ✕. Stays live while the player is loading or disabled: closing is how a
 * host's user gets rid of a player they can't otherwise use.
 */
export const CloseButton: React.FC<CloseButtonProps> = ({
  onClick,
  size = 24,
  className = 'p-0',
}) => (
  <button
    type='button'
    onClick={onClick}
    className={`${className} flex-shrink-0 rounded-full text-muted hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-fg`}
    aria-label='Close player'
  >
    <X size={size} />
  </button>
);
