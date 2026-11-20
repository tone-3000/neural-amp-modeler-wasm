import React, { ReactNode } from 'react';
import { PlayerController } from '../hooks/usePlayer';
import { CloseButton } from './CloseButton';
import { ExpandToggle, TimeReadout, Transport, Waveform } from './Playbar';
import { ToneHeader } from './ToneHeader';

/** The row's height, and so how much of the waveform shows. */
const ROW_HEIGHT = 72;

/**
 * A 24px glyph in a 40px target. The targets sit edge to edge, so a near miss
 * lands on the button that was meant rather than its neighbour.
 */
const ICON_BUTTON = 'w-10 h-10 flex items-center justify-center';

interface BarRowProps {
  controller: PlayerController;
  disabled: boolean;
  linkTarget: '_blank' | '_self';
  headerSlot?: ReactNode;
  /** Render the expand/collapse chevron. */
  expandToggle: boolean;
  /** Renders the close button. */
  onClose?: () => void;
}

/**
 * The `bar` layout's one row, in three zones:
 *
 *   [ image  title            ] [ ▶ ⏮  waveform  0:08 / 0:25 ] [ ⓘ ⌄ ✕ ]
 *   [        author           ]
 *
 * The tone takes a fixed share of the width, so the transport stays where it
 * is from one tone to the next. Narrow, the row is the tone and the buttons
 * that act on it:
 *
 *   [ image  title            ] [ ▶ ] [ ⌄ ✕ ]
 *   [        author           ]
 *
 * Which of the two it is, is decided in index.css (`.t3k-bar`).
 */
export const BarRow: React.FC<BarRowProps> = ({
  controller: c,
  disabled,
  linkTarget,
  headerSlot,
  expandToggle,
  onClose,
}) => {
  const meta = c.activeTone.meta;
  return (
    <div
      className='flex items-center gap-3 sm:gap-4 w-full'
      style={{ minHeight: ROW_HEIGHT }}
    >
      {meta && (
        <div className='t3k-bar-meta'>
          <ToneHeader
            meta={meta}
            variant='inline'
            linkTarget={linkTarget}
            onLinkClick={c.linkClicked}
          />
        </div>
      )}

      <Transport
        controller={c}
        disabled={disabled}
        skipClassName='t3k-bar-wide rounded-full focus-visible:ring-2 focus-visible:ring-fg'
      />

      <Waveform
        controller={c}
        height={ROW_HEIGHT}
        className='t3k-bar-wide overflow-hidden'
      />

      {c.sourceMode !== 'live' && (
        <TimeReadout
          controller={c}
          disabled={disabled}
          className='t3k-bar-time flex'
        />
      )}

      {/* `ml-auto`: with the waveform gone, the actions still end the row. */}
      <div
        className={`flex items-center gap-1 flex-shrink-0 ml-auto ${
          // The last glyph, not its target, lines up with the row's edge.
          expandToggle || onClose ? '-mr-2' : ''
        }`}
      >
        {headerSlot && (
          <span className='t3k-bar-wide flex items-center'>{headerSlot}</span>
        )}
        {expandToggle && (
          <ExpandToggle
            controller={c}
            disabled={disabled}
            className={`${ICON_BUTTON} flex-shrink-0 rounded-full text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-fg disabled:cursor-not-allowed disabled:opacity-50`}
          />
        )}
        {onClose && (
          <CloseButton onClick={onClose} size={20} className={ICON_BUTTON} />
        )}
      </div>
    </div>
  );
};
