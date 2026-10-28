import React from 'react';
import { Loader2, Lock, Mic } from 'lucide-react';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import {
  getBrowserName,
  isFramed,
  type BrowserName,
} from '../../utils/browser';
import { LiveSetup } from '../hooks/useLiveSetup';

export const Privacy = () => (
  <p className='flex items-start gap-2 text-sm text-muted'>
    <Lock size={16} aria-hidden='true' className='flex-shrink-0 mt-0.5' />
    Audio is processed locally and never leaves your device.
  </p>
);

function BlockedSteps({ browser }: { browser: BrowserName }) {
  const steps: Record<BrowserName, [string, string[]]> = {
    chrome: [
      'Chrome',
      [
        'Click the site controls icon to the left of the address bar',
        'Set Microphone to Allow',
        'Refresh the page',
      ],
    ],
    edge: [
      'Edge',
      [
        'Click the icon to the left of the address bar',
        'Open Permissions for this site and set Microphone to Allow',
        'Refresh the page',
      ],
    ],
    firefox: [
      'Firefox',
      [
        'Click the icon to the left of the address bar',
        'Under Permissions, set Use the Microphone to Allow',
        'Refresh the page',
      ],
    ],
    safari: [
      'Safari',
      [
        'In the menu bar choose Safari → Settings for This Website…',
        'Set Microphone to Allow',
        'Refresh the page',
      ],
    ],
    other: [
      'your browser',
      [
        'Open the site settings next to the address bar',
        'Set Microphone to Allow',
        'Refresh the page',
      ],
    ],
  };
  const [name, list] = steps[browser];
  return (
    <>
      <p>To turn it back on in {name}:</p>
      <ol className='list-decimal list-inside space-y-1 text-fg'>
        {list.map(step => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </>
  );
}

interface MicPermissionProps {
  live: LiveSetup;
  disabled?: boolean;
  /** Tone page to open when the embedding site is the one saying no. */
  href?: string;
  linkTarget?: '_blank' | '_self';
}

/**
 * The "Microphone Access" step of the live wizard: what to click in the
 * browser prompt, the Allow button, and per-browser steps if it's blocked.
 */
export const MicPermission: React.FC<MicPermissionProps> = ({
  live,
  disabled = false,
  href,
  linkTarget = '_blank',
}) => {
  const pending = live.permission === 'pending';
  const blocked = live.permission === 'blocked';
  const retryable = live.permission === 'denied' || live.permission === 'error';

  return (
    // One left-aligned column, as wide as the Allow button: steps, alerts,
    // button and privacy note line up instead of the text running panel-wide.
    <div className='flex flex-col gap-4 w-full max-w-md'>
      <div className='text-muted-2'>
        Allow microphone access to connect your interface:
        <ol className='list-decimal list-inside mt-2 space-y-1 text-fg'>
          <li>"Allow Microphone"</li>
          <li>"Allow while visiting the site"</li>
        </ol>
      </div>

      {blocked && (
        <Alert variant='error'>
          <span className='font-semibold'>
            Microphone is blocked for this site
          </span>
          <BlockedSteps browser={getBrowserName()} />
          {isFramed && (
            // Firefox/Safari can't tell us whether it's the user or the
            // embedding page that said no.
            <p className='pt-1'>
              If this player is embedded in another site, that site also has to
              allow microphone access
              {href ? (
                <>
                  {' '}
                  — or{' '}
                  <a
                    href={href}
                    target={linkTarget}
                    rel='noopener noreferrer'
                    className='underline text-fg'
                  >
                    open the tone on TONE3000
                  </a>
                </>
              ) : null}
              .
            </p>
          )}
        </Alert>
      )}

      {retryable && (
        <Alert variant='error'>
          {live.error ??
            'Microphone access was denied. Try again and choose "Allow".'}
        </Alert>
      )}

      {blocked ? (
        <Button
          variant='secondary'
          fullWidth
          onClick={() => window.location.reload()}
          disabled={disabled}
        >
          Refresh page
        </Button>
      ) : (
        <Button
          variant='primary'
          fullWidth
          leftIcon={
            pending ? (
              <Loader2 size={18} className='animate-spin' />
            ) : (
              <Mic size={18} />
            )
          }
          onClick={() => void live.connect()}
          disabled={disabled || pending}
        >
          {pending ? 'Asking for permission…' : 'Allow Microphone'}
        </Button>
      )}

      <Privacy />
    </div>
  );
};
