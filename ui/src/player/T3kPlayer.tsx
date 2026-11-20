import React, {
  ForwardedRef,
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
} from 'react';
import { T3kPlayerHandle, T3kPlayerProps } from '../types';
import { usePlayer } from './hooks/usePlayer';
import { useRootResize } from './hooks/useRootResize';
import { useRootVisible } from './hooks/useRootVisible';
import { MiniLayout } from './layouts/MiniLayout';
import { PanelLayout } from './layouts/PanelLayout';

/**
 * The player. One component for every surface:
 *
 * - one tone → single player; two or more → playlist
 * - `layout` picks `mini` | `compact` | `full` | `bar`
 * - all state changes surface through `onEvent`
 * - a `ref` gives `play()` / `pause()` to controls outside the player
 *
 * Must be rendered inside `T3kPlayerProvider`.
 */
function Player(props: T3kPlayerProps, ref: ForwardedRef<T3kPlayerHandle>) {
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
    collapseTabs = false,
    pinned = false,
    onClose,
    size,
    onEvent,
  } = props;

  // `mini` and `bar` have nowhere to put a pager.
  const singleOnly = layout === 'mini' || layout === 'bar';
  const isPlaylist = tones.length > 1;
  if (isPlaylist && singleOnly) {
    console.warn(
      `[T3kPlayer] \`${layout}\` layout does not support playlists; rendering \`compact\`.`
    );
  }
  const effectiveLayout = isPlaylist && singleOnly ? 'compact' : layout;

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

  const { togglePlay, isTonePlaying, pause, activeToneId } = controller;
  useImperativeHandle(
    ref,
    () => ({
      play: async toneId => {
        const id = toneId ?? activeToneId;
        if (!isTonePlaying(id)) await togglePlay(id);
      },
      pause,
    }),
    [togglePlay, isTonePlaying, pause, activeToneId]
  );

  const rootRef = useRef<HTMLDivElement>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const reportHeight = useCallback(
    (height: number) => onEventRef.current?.({ type: 'resize', height }),
    []
  );
  useRootResize(rootRef, onEvent ? reportHeight : undefined);
  const reportVisible = useCallback(
    () => onEventRef.current?.({ type: 'visible' }),
    []
  );
  useRootVisible(rootRef, onEvent ? reportVisible : undefined);

  const status = isLoading ? 'loading' : disabled ? 'disabled' : 'ready';
  const disabledReason =
    typeof disabled === 'object' ? disabled.reason : undefined;
  const attributionHref =
    typeof attribution === 'object' ? attribution.href : undefined;

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
          attribution={attribution !== false}
          attributionHref={attributionHref}
          linkTarget={linkTarget}
          docked={docked}
          collapseTabs={collapseTabs}
          pinned={pinned}
          onClose={onClose}
        />
      )}
    </div>
  );
}

export const T3kPlayer = forwardRef(Player);
T3kPlayer.displayName = 'T3kPlayer';

export default T3kPlayer;
