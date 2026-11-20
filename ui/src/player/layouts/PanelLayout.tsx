import React, { ReactNode } from 'react';
import { Tabs } from '../../components/ui/Tabs';
import { SourceMode } from '../../types';
import { PlayerController } from '../hooks/usePlayer';
import { AudioSettings } from '../parts/AudioSettings';
import { BarRow } from '../parts/BarRow';
import { CloseButton } from '../parts/CloseButton';
import { Controls } from '../parts/Controls';
import { ControlsSkeleton } from '../parts/ControlsSkeleton';
import { LiveConnect } from '../parts/LiveConnect';
import { Pager } from '../parts/Pager';
import { Playbar } from '../parts/Playbar';
import { PoweredBy } from '../parts/PoweredBy';
import { ToneHeader } from '../parts/ToneHeader';

export interface PanelLayoutProps {
  controller: PlayerController;
  layout: 'compact' | 'full' | 'bar';
  live: boolean;
  status: 'ready' | 'loading' | 'disabled';
  disabledReason?: string;
  headerSlot?: ReactNode;
  attribution: boolean;
  /** Where the attribution logo links to; the part's default when omitted. */
  attributionHref?: string;
  linkTarget: '_blank' | '_self';
  /** Drop the top border + radius so the panel docks under a host card. */
  docked: boolean;
  /** `compact`: tabs / attribution open with the controls, not on top. */
  collapseTabs: boolean;
  /** Along the bottom of the page: square, top border only. */
  pinned: boolean;
  /** Renders the close button. */
  onClose?: () => void;
}

const SOURCE_TABS: { mode: SourceMode; label: string }[] = [
  { mode: 'demo', label: 'Sample' },
  { mode: 'live', label: 'Plug in and play' },
];

const SECTION = 'px-4 sm:px-6';

/**
 * `compact`, `full` and `bar` are one set of sections in three arrangements.
 *
 * `full` (tone page, share embed):
 *
 *   [ Sample | Plug in and play              TONE3000 ]   source tabs / attribution
 *   [ image  title · author · gear · pill       ‹ n/N › ]   tone header (+ pager)
 *   [ playbar                                          ]
 *   [ controls | live setup wizard | play live         ]
 *
 * `compact` (docked under a card, or a standalone bar in an embed): the
 * same stack with a dense header, and the body behind the chevron.
 *
 *   [ Sample | Plug in and play              TONE3000 ]
 *   [ image  title                             ‹ n/N › ]   dense header: playlists, or not docked
 *   [ playbar                                        ⌄ ]
 *   [ controls | live setup wizard | play live         ]   expanded
 *
 * `compact` with `collapseTabs`: the playbar is the whole collapsed player;
 * the chevron opens the tabs along with the body.
 *
 *   [ image  title                             ‹ n/N › ]
 *   [ playbar                                        ⌄ ]
 *   [ Sample | Plug in and play              TONE3000 ]   ┐ expanded
 *   [ controls | live setup wizard | play live         ]   ┘
 *
 * `bar`: the header and the playbar are one row (parts/BarRow), and the
 * tabs always open with the body.
 *
 *   [ image  title   ▶ ⏮  waveform  0:08 / 0:25    ⌄ ]
 *   [ Sample | Plug in and play              TONE3000 ]   ┐ expanded
 *   [ controls | live setup wizard | play live         ]   ┘
 *
 * `pinned` is any of these with square corners and only a top border, for a
 * player along the bottom edge of the page. It opens the same way, under the
 * playbar; what opens scrolls within itself on a screen too short for it.
 *
 * `onClose` adds ✕ to the end of the header, or of the playbar when there
 * is no header.
 */
export const PanelLayout: React.FC<PanelLayoutProps> = ({
  controller: c,
  layout,
  live,
  status,
  disabledReason,
  headerSlot,
  attribution,
  attributionHref,
  linkTarget,
  docked,
  collapseTabs,
  pinned,
  onClose,
}) => {
  const isPlaylist = c.tones.length > 1;
  const isFull = layout === 'full';
  const isBar = layout === 'bar';
  const tabsOnTop = isFull || (!isBar && !collapseTabs);
  const inert = status !== 'ready';
  const isLive = live && c.sourceMode === 'live';
  const meta = c.activeTone.meta;
  // `compact` docked under a card leaves the image and name to the card; a
  // standalone compact bar (share embed, pinned to the page) carries them in
  // the dense header.
  const underCard = docked && !pinned;
  const showHeader =
    !isBar && (isPlaylist || (!!meta && (isFull || !underCard)));
  const showTabBar = live || attribution;
  const assetError =
    c.activeAssets.status === 'error' ? c.activeAssets.message : null;
  const assetsPending =
    c.activeAssets.status === 'idle' || c.activeAssets.status === 'loading';

  const selectSource = (mode: SourceMode) => {
    // A collapsed `compact` hides the connect flow, leaving only a disabled
    // monitor button on the bar: open the panel so going live isn't a dead end.
    if (
      mode === 'live' &&
      !isFull &&
      !c.expanded &&
      c.live.status !== 'ready'
    ) {
      c.setExpanded(true);
    }
    void c.setSourceMode(mode);
  };

  const tabBar = showTabBar && (
    <div
      className={`${SECTION} t3k-tabbar ${
        // The attribution's step-down thresholds depend on whether it
        // shares the row with the tabs (index.css).
        live ? 't3k-has-tabs' : 't3k-no-tabs'
      } flex items-center justify-between gap-4 ${
        // On top, the tabs are ruled off from the header / bar beneath;
        // collapsed into the body they sit directly under the bar, like the
        // v2 accordion.
        tabsOnTop ? 'border-b border-line' : ''
      }`}
    >
      {live ? (
        <Tabs
          tabs={SOURCE_TABS.map(t => t.label)}
          activeTab={SOURCE_TABS.findIndex(t => t.mode === c.sourceMode)}
          setActiveTab={i => selectSource(SOURCE_TABS[i].mode)}
          disabled={inert}
          fill={false}
        />
      ) : (
        <span />
      )}
      {attribution && (
        <PoweredBy
          href={attributionHref}
          onClick={href => c.linkClicked('attribution', href)}
          className='py-3'
        />
      )}
    </div>
  );

  const closeButton = onClose && (
    <CloseButton onClick={onClose} className='t3k-header-close p-0' />
  );

  const playbar = isBar ? (
    <BarRow
      controller={c}
      disabled={inert}
      linkTarget={linkTarget}
      headerSlot={headerSlot}
      expandToggle={!inert}
      onClose={onClose}
    />
  ) : (
    <Playbar
      controller={c}
      disabled={inert}
      headerSlot={
        showHeader ? (
          headerSlot
        ) : (
          <>
            {headerSlot}
            {closeButton}
          </>
        )
      }
      expandToggle={!isFull && !inert}
    />
  );

  const controls = (
    <>
      {assetError ? (
        <p className='text-sm text-danger'>{assetError}</p>
      ) : assetsPending ? (
        <ControlsSkeleton />
      ) : (
        <Controls controller={c} />
      )}
      {c.error && !assetError && (
        <p className='text-sm text-danger pt-2'>{c.error}</p>
      )}
    </>
  );

  // The live-only panels that take the controls' place, under the playbar:
  // the setup wizard (permission → interface), or the "Play Live" takeover
  // until an interface is connected.
  let livePanel: ReactNode = null;
  if (isLive && c.view === 'settings') {
    livePanel = (
      <AudioSettings
        controller={c}
        onClose={() => c.setView('controls')}
        disabled={inert}
        href={meta?.href}
        linkTarget={linkTarget}
      />
    );
  } else if (isLive && c.live.status !== 'ready') {
    livePanel = (
      <LiveConnect
        controller={c}
        disabled={inert}
        href={meta?.href}
        linkTarget={linkTarget}
      />
    );
  }

  // What the chevron opens (`compact`, `bar`).
  let expanded: ReactNode = null;
  if (!isFull && !inert && c.expanded) {
    expanded = (
      <>
        {!tabsOnTop && tabBar}
        <div className={`${SECTION} t3k-body py-4 sm:py-5`}>
          {livePanel ?? controls}
        </div>
      </>
    );
    // Held to the page's edge, the player grows upward: keep it on screen.
    if (pinned) expanded = <div className='t3k-pinned-panel'>{expanded}</div>;
  }

  let body: ReactNode;
  if (isFull) {
    body = (
      <div className={`${SECTION} t3k-body flex flex-col gap-3 py-2 sm:py-3`}>
        {playbar}
        {status === 'disabled' && disabledReason && (
          <p className='text-sm text-muted -mt-2 pb-2'>{disabledReason}</p>
        )}
        {!inert && <div className='pb-3 sm:pb-4'>{livePanel ?? controls}</div>}
      </div>
    );
  } else {
    body = (
      // No vertical padding: the bar's own min-height (80px, a 90px canvas;
      // 72px in `bar`) is the collapsed height, same as the v2 accordion.
      <div className={isBar ? `${SECTION} t3k-bar` : SECTION}>
        {playbar}
        {status === 'disabled' && disabledReason && (
          <p className='text-sm text-muted -mt-1 pb-3'>{disabledReason}</p>
        )}
      </div>
    );
  }

  return (
    <div
      className={`bg-surface border-line text-fg w-full flex flex-col overflow-hidden ${
        pinned
          ? 'border-t'
          : docked
            ? 'border border-t-0 rounded-b-t3k'
            : 'border rounded-t3k'
      } ${inert ? 'opacity-50' : ''}`}
      aria-busy={status === 'loading' || undefined}
      aria-disabled={status === 'disabled' || undefined}
    >
      {tabsOnTop && tabBar}

      {showHeader && (
        <div
          className={`${SECTION} t3k-header flex flex-wrap items-center gap-4 py-3 sm:py-4 border-b border-line`}
        >
          {meta ? (
            <ToneHeader
              meta={meta}
              variant={isFull ? 'default' : 'dense'}
              linkTarget={linkTarget}
              onLinkClick={c.linkClicked}
            />
          ) : (
            <span className='flex-1 text-sm text-muted'>
              Tone {c.activeIndex + 1}
            </span>
          )}
          {/* Ahead of the pager in the DOM, after it on screen (index.css). */}
          {closeButton}
          {isPlaylist && (
            <Pager
              index={c.activeIndex}
              count={c.tones.length}
              onStep={c.step}
              disabled={inert || c.isBusy}
              className='t3k-header-pager'
            />
          )}
        </div>
      )}

      {body}

      {expanded}
    </div>
  );
};
