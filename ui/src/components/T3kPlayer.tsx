import React from 'react';
import { PREVIEW_MODE, T3kPlayerProps } from '../types';
import Player from './Player/Player';
import { PlayerSkeleton } from './Player/PlayerSkeleton';
import { T3kDisabledPlayer } from './T3kDisabledPlayer';

export const T3kPlayer: React.FC<T3kPlayerProps> = ({
  isLoading,
  previewMode = PREVIEW_MODE.MODEL,
  disabled,
  models,
  infoSlot,
  ...props
}) => {
  if (isLoading) {
    return (
      <div className='neural-amp-modeler'>
        <PlayerSkeleton previewMode={previewMode} />
      </div>
    );
  }

  if (disabled) {
    return <T3kDisabledPlayer infoSlot={infoSlot} />;
  }

  return (
    <div className='neural-amp-modeler'>
      <Player
        {...props}
        models={models}
        previewMode={previewMode}
        infoSlot={infoSlot}
      />
    </div>
  );
};

export default T3kPlayer;
