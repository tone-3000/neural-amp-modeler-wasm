import React, { ReactNode } from 'react';
import { Tabs } from '../../components/ui/Tabs';
import { SourceMode } from '../../types';
import { PlayerController } from '../hooks/usePlayer';
import { AudioSettings } from '../parts/AudioSettings';
import { Controls } from '../parts/Controls';
import { ControlsSkeleton } from '../parts/ControlsSkeleton';
import { LiveConnect } from '../parts/LiveConnect';
import { Pager } from '../parts/Pager';
import { Playbar } from '../parts/Playbar';
import { PoweredBy } from '../parts/PoweredBy';
import { ToneHeader } from '../parts/ToneHeader';

export interface PanelLayoutProps {
  controller: PlayerController;
  layout: 'compact' | 'full';
  live: boolean;
  status: 'ready' | 'loading' | 'disabled';
  disabledReason?: string;
  headerSlot?: ReactNode;
  attribution: boolean;
  linkTarget: '_blank' | '_self';
  /** Drop the top border + radius so the panel docks under a host card. */
  docked: boolean;
}

const SOURCE_TABS: { mode: SourceMode; label: string }[] = [
  { mode: 'demo', label: 'Sample' },
  { mode: 'live', label: 'Plug in and play' },
];

const SECTION = 'px-4 sm:px-6';

/**
 * `compact` and `full` are one set of sections in two orders.
 *
 * `full` (tone page, share embed):
 *
 *   [ Sample | Plug in and play            Powered by ]   source tabs / attribution
 *   [ image  title · author · gear · pill       ‹ n/N › ]   tone header (+ pager)
 *   [ playbar                                          ]
 *   [ controls | live setup wizard | play live         ]
 *
 * `compact` (docked under a card): the playbar is the whole collapsed
 * player; the chevron opens the tabs and the body beneath it.
 *
 *   [ image  title                             ‹ n/N › ]   dense header, playlists only
 *   [ playbar                                        ⌄ ]
 *   [ Sample | Plug in and play            Powered by ]   ┐ expanded
 *   [ controls | live setup wizard | play live         ]   ┘
 */
export const PanelLayout: React.FC<PanelLayoutProps> = ({
  controller: c,
  layout,
  live,
  status,
  disabledReason,
  headerSlot,
  attribution,
  linkTarget,
  docked,
}) => {
  const isPlaylist = c.tones.length > 1;
  const isFull = layout === 'full';
  const inert = status !== 'ready';
  const isLive = live && c.sourceMode === 'live';
  const meta = c.activeTone.meta;
  const showHeader = (isFull && meta) || isPlaylist;
  const showTabBar = live || attribution;
  const assetError =
    c.activeAssets.status === 'error' ? c.activeAssets.message : null;
  const assetsPending =
    c.activeAssets.status === 'idle' || c.activeAssets.status === 'loading';

  const tabBar = showTabBar && (
    <div
      className={`${SECTION} t3k-tabbar flex items-center justify-between gap-4 ${
        // Only `full` rules the tabs off from the header beneath; in
        // `compact` the tabs sit directly under the bar, like the v2 accordion.
        isFull ? 'border-b border-line' : ''
      }`}
    >
      {live ? (
        <Tabs
          tabs={SOURCE_TABS.map(t => t.label)}
          activeTab={SOURCE_TABS.findIndex(t => t.mode === c.sourceMode)}
          setActiveTab={i => void c.setSourceMode(SOURCE_TABS[i].mode)}
          disabled={inert}
          fill={false}
        />
      ) : (
        <span />
      )}
      {attribution && <PoweredBy className='py-3' />}
    </div>
  );

  const playbar = (
    <Playbar
      controller={c}
      disabled={inert}
      headerSlot={headerSlot}
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
      <>
        {/* No vertical padding: the bar's own 80px min-height / 90px canvas
            is the collapsed height, same as the v2 accordion. */}
        <div className={SECTION}>
          {playbar}
          {status === 'disabled' && disabledReason && (
            <p className='text-sm text-muted -mt-1 pb-3'>{disabledReason}</p>
          )}
        </div>
        {!inert && c.expanded && (
          <>
            {tabBar}
            <div className={`${SECTION} t3k-body py-4 sm:py-5`}>
              {livePanel ?? controls}
            </div>
          </>
        )}
      </>
    );
  }

  return (
    <div
      className={`bg-surface border border-line text-fg w-full flex flex-col overflow-hidden ${
        docked ? 'rounded-b-t3k border-t-0' : 'rounded-t3k'
      } ${inert ? 'opacity-50' : ''}`}
      aria-busy={status === 'loading' || undefined}
      aria-disabled={status === 'disabled' || undefined}
    >
      {isFull && tabBar}

      {showHeader && (
        <div
          className={`${SECTION} t3k-header flex flex-wrap items-center gap-4 py-3 sm:py-4 border-b border-line`}
        >
          {meta ? (
            <ToneHeader
              meta={meta}
              variant={isFull ? 'default' : 'dense'}
              linkTarget={linkTarget}
            />
          ) : (
            <span className='flex-1 text-sm text-muted'>
              Tone {c.activeIndex + 1}
            </span>
          )}
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
    </div>
  );
};
