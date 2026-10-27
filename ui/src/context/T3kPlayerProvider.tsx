import React, { ReactNode } from 'react';
import { T3kPlayerContextProvider } from './T3kPlayerContext';
import type { NamEngineAssets } from '../engine';

/**
 * Wrap the part of your app that renders players. One provider = one audio
 * engine (created lazily on the first play) shared by every player inside.
 */
export function T3kPlayerProvider({
  children,
  engineAssets,
}: {
  children: ReactNode;
  /** Optional override for where the engine assets are served from. */
  engineAssets?: NamEngineAssets;
}) {
  return (
    <T3kPlayerContextProvider engineAssets={engineAssets}>
      {children}
    </T3kPlayerContextProvider>
  );
}
