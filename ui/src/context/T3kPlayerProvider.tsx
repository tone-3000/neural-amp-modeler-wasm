import React, { ReactNode } from 'react';
import {
  T3kPlayerContextProvider,
  useT3kPlayerContext,
} from './T3kPlayerContext';
import { SettingsDialog } from '../components/SettingsDialog';
import type { NamEngineAssets } from '../engine';

/** Renders the global settings dialog when open. Included once by T3kPlayerProvider. */
function SettingsDialogRenderer() {
  const { settingsDialog, closeSettingsDialog } = useT3kPlayerContext();

  if (
    !settingsDialog.isOpen ||
    !settingsDialog.selectedModel ||
    !settingsDialog.selectedIr
  ) {
    return null;
  }

  return (
    <div className='neural-amp-modeler' style={{ background: 'none' }}>
      <SettingsDialog
        isOpen={true}
        onClose={closeSettingsDialog}
        sourceMode={settingsDialog.sourceMode}
        selectedModel={settingsDialog.selectedModel}
        selectedIr={settingsDialog.selectedIr}
        playerId={settingsDialog.playerId}
        onMonitoringChange={settingsDialog.onMonitoringChange}
      />
    </div>
  );
}

/**
 * Recommended provider for the T3k player. Wraps T3kPlayerContextProvider and
 * includes SettingsDialogRenderer once (shared by all players on the page).
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
      <SettingsDialogRenderer />
    </T3kPlayerContextProvider>
  );
}
