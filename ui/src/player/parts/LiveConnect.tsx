import React from 'react';
import { Loader2 } from 'lucide-react';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Guitar } from '../../components/ui/Guitar';
import { isFramed, microphoneAllowedByPolicy } from '../../utils/browser';
import { PlayerController } from '../hooks/usePlayer';

/** Matches the controls' height so the panel doesn't jump between tabs. */
const MIN_HEIGHT = 'min-h-[150px]';

/** The host page's `<iframe>` lacks `allow="microphone"`: nothing to retry. */
function EmbedDenied({
  href,
  linkTarget,
}: Pick<LiveConnectProps, 'href' | 'linkTarget'>) {
  return (
    <div className={`flex flex-col justify-center gap-4 ${MIN_HEIGHT}`}>
      <Alert variant='warning'>
        <span className='font-semibold text-base'>
          This embed can't use your audio interface
        </span>
        <p className='text-muted-2'>
          The page embedding this player hasn't allowed microphone access.
          {href ? ' Open the tone on TONE3000 to plug in and play.' : ''}
        </p>
      </Alert>
      {href && (
        <div>
          <Button
            variant='secondary'
            onClick={() => window.open(href, linkTarget)}
          >
            Open on TONE3000
          </Button>
        </div>
      )}
    </div>
  );
}

interface LiveConnectProps {
  controller: PlayerController;
  disabled?: boolean;
  /** Where to send the user when live mode can't run here (embeds). */
  href?: string;
  linkTarget?: '_blank' | '_self';
}

/**
 * The "Play Live" takeover shown in the controls' place until an interface
 * is connected. Connect opens the inline setup wizard (permission →
 * interface); with permission already granted it also starts connecting.
 */
export const LiveConnect: React.FC<LiveConnectProps> = ({
  controller: c,
  disabled = false,
  href,
  linkTarget = '_blank',
}) => {
  const { live } = c;

  // Inside an iframe whose host didn't grant the microphone, both the
  // untouched and the already-denied states mean the same thing.
  if (
    isFramed &&
    microphoneAllowedByPolicy() === false &&
    (live.status === 'connect' || live.status === 'blocked')
  ) {
    return <EmbedDenied href={href} linkTarget={linkTarget} />;
  }

  if (live.status === 'connecting' || live.status === 'pending') {
    return (
      <div
        className={`flex items-center justify-center gap-3 ${MIN_HEIGHT} text-muted-2`}
        role='status'
      >
        <Loader2 size={24} className='animate-spin' aria-hidden='true' />
        {live.status === 'pending'
          ? 'Waiting for microphone permission…'
          : 'Connecting to your interface…'}
      </div>
    );
  }

  const connect = () => {
    c.setView('settings');
    if (live.permission === 'granted') void live.connect();
  };

  return (
    <div
      className={`flex flex-col items-center justify-center gap-5 text-center ${MIN_HEIGHT}`}
    >
      <div className='flex flex-col items-center gap-2 text-muted'>
        <Guitar size={56} />
        <h3 className='font-semibold text-fg'>Play Live</h3>
        <p className='text-sm text-muted-2 max-w-[360px]'>
          Play this tone with your own instrument by connecting it to an audio
          interface. Nothing to install.
        </p>
      </div>
      <Button variant='secondary' onClick={connect} disabled={disabled}>
        Connect
      </Button>
      {live.error && live.permission !== 'blocked' && (
        <Alert variant='error'>{live.error}</Alert>
      )}
    </div>
  );
};
