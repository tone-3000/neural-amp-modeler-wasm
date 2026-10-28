import React, { useCallback, useRef } from 'react';
import { T3kPlayerProps } from '../types';
import { usePlayer } from './hooks/usePlayer';
import { useRootResize } from './hooks/useRootResize';
import { MiniLayout } from './layouts/MiniLayout';
import { PanelLayout } from './layouts/PanelLayout';

/**
 * The player. One component for every surface:
 *
 * - one tone → single player; two or more → playlist
 * - `layout` picks `mini` | `compact` | `full`
 * - all state changes surface through `onEvent`
 *
 * Must be rendered inside `T3kPlayerProvider`.
 */
export const T3kPlayer: React.FC<T3kPlayerProps> = props => {
  const {
    tones,
    layout = 'full',
    live = true,
    disabled = false,
    isLoading = false,
    theme = 'dark',
    headerSlot,
    attribution = true,
    linkTarget = '_blank',
    docked = false,
    size,
    onEvent,
  } = props;

  const isPlaylist = tones.length > 1;
  if (isPlaylist && layout === 'mini') {
    console.warn(
      '[T3kPlayer] `mini` layout does not support playlists; rendering `compact`.'
    );
  }
  const effectiveLayout = isPlaylist && layout === 'mini' ? 'compact' : layout;

  const controller = usePlayer({
    tones,
    id: props.id,
    defaultToneId: props.defaultToneId,
    defaultExpanded: props.defaultExpanded,
    slimSize: props.slimSize,
    onEvent,
    live,
    layout: effectiveLayout,
  });

  const rootRef = useRef<HTMLDivElement>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const reportHeight = useCallback(
    (height: number) => onEventRef.current?.({ type: 'resize', height }),
    []
  );
  useRootResize(rootRef, onEvent ? reportHeight : undefined);

  const status = isLoading ? 'loading' : disabled ? 'disabled' : 'ready';
  const disabledReason =
    typeof disabled === 'object' ? disabled.reason : undefined;

  return (
    <div
      ref={rootRef}
      className='neural-amp-modeler'
      data-layout={effectiveLayout}
      data-theme={theme}
      data-player-id={controller.playerId}
      style={
        effectiveLayout === 'mini' ? { display: 'inline-flex' } : undefined
      }
    >
      {effectiveLayout === 'mini' ? (
        <MiniLayout controller={controller} status={status} size={size} />
      ) : (
        <PanelLayout
          controller={controller}
          layout={effectiveLayout}
          live={live}
          status={status}
          disabledReason={disabledReason}
          headerSlot={headerSlot}
          attribution={attribution}
          linkTarget={linkTarget}
          docked={docked}
        />
      )}
    </div>
  );
};

export default T3kPlayer;
