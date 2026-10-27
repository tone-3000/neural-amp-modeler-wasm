import React from 'react';
import ReactDOM from 'react-dom/client';
import { T3kPlayer } from '../player/T3kPlayer';
import { T3kPlayerProvider } from '../context/T3kPlayerProvider';
import { useEmbedBridge } from '../embed/useEmbedBridge';
import { NonEmptyArray, PlayerLayout, PlayerTone } from '../types';
import { demoTone } from './tones';
import '../index.css';

/**
 * Stand-in for tone3000.com/embed/player. Reads the same query params the
 * real route will (`tones`, `layout`, `live`) and renders a player wired to
 * the embed bridge. Open it inside /embed.html.
 */
const params = new URLSearchParams(window.location.search);
const layout = (params.get('layout') as PlayerLayout | null) ?? 'full';
// Live mode needs `allow="microphone"` on the host's iframe; `live=0` hides
// the tab for hosts that don't want it.
const live = params.get('live') !== '0';
const indices = (params.get('tones') ?? '0')
  .split(',')
  .map(Number)
  .filter(n => Number.isInteger(n) && n >= 0 && n <= 6);
const tones = (indices.length ? indices : [0]).map(i =>
  demoTone(i, { lazy: true })
) as NonEmptyArray<PlayerTone>;

const Frame: React.FC = () => {
  const bridge = useEmbedBridge();
  return (
    <T3kPlayer
      tones={tones}
      layout={layout}
      live={live}
      linkTarget='_blank'
      // No resizer on the host → the frame can't grow, so open expanded.
      defaultExpanded={bridge.hostHasResizer === false}
      onEvent={bridge.onEvent}
    />
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <T3kPlayerProvider engineAssets={{ assetBaseUrl: '/engine/' }}>
      <Frame />
    </T3kPlayerProvider>
  </React.StrictMode>
);
