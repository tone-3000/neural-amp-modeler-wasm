import React, { ReactNode } from 'react';
import { Info, Loader2, Settings, X } from 'lucide-react';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { InputMeter } from '../../components/ui/InputMeter';
import { InterfaceIcon } from '../../components/ui/Interface';
import { NativeSelect } from '../../components/ui/NativeSelect';
import { Radio } from '../../components/ui/Radio';
import { ToggleSimple } from '../../components/ui/ToggleSimple';
import { useT3kPlayerContext } from '../../context/T3kPlayerContext';
import { isSafari, speakerSelectionAllowedByPolicy } from '../../utils/browser';
import { PlayerController } from '../hooks/usePlayer';
import { MicPermission } from './MicPermission';

interface AudioSettingsProps {
  controller: PlayerController;
  onClose: () => void;
  disabled?: boolean;
  href?: string;
  linkTarget?: '_blank' | '_self';
}

/** Bold heading + muted helper line above a control. */
const Field = ({
  heading,
  helper,
  children,
}: {
  heading: string;
  helper: string;
  children: ReactNode;
}) => (
  <div className='flex flex-col gap-2'>
    <div className='flex flex-col'>
      <span className='font-semibold text-fg'>{heading}</span>
      <span className='text-sm text-muted-2'>{helper}</span>
    </div>
    {children}
  </div>
);

/** Stand-in for a select while the engine / interface is coming up. */
const Initializing = () => (
  <div
    className='flex items-center justify-between w-full px-4 py-3 text-md border border-line rounded-md opacity-50 cursor-wait'
    role='status'
  >
    <span className='truncate'>Initializing audio…</span>
    <Loader2
      size={20}
      className='text-muted flex-shrink-0 animate-spin'
      aria-hidden='true'
    />
  </div>
);

/**
 * The inline live-setup wizard: microphone permission, then the audio
 * interface (device, input channel, output, monitoring) with a Done button.
 * Lives where the controls do, so it works inside an iframe without a modal.
 */
export const AudioSettings: React.FC<AudioSettingsProps> = ({
  controller: c,
  onClose,
  disabled = false,
  href,
  linkTarget,
}) => {
  const { getGraph } = useT3kPlayerContext();
  const { live } = c;
  const permissionStep = live.permission !== 'granted';
  const config = live.config;
  const connecting = live.status === 'connecting';
  const channelCount = config?.channelCount ?? 0;
  const multi = channelCount >= 2;
  const meters = getGraph()?.liveMeters ?? null;
  const hearing = c.isActive;

  const setHearing = (on: boolean) => {
    if (on !== hearing) void c.togglePlay();
  };

  const header = (
    <div className='flex items-center justify-between'>
      <div className='flex items-center gap-3'>
        {permissionStep ? <Info size={22} /> : <Settings size={22} />}
        <h3 className='text-lg font-semibold text-fg'>
          {permissionStep ? 'Microphone Access' : 'Settings'}
        </h3>
      </div>
      <button
        type='button'
        onClick={onClose}
        disabled={live.permission === 'pending'}
        className='text-muted hover:text-fg p-1 -m-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-fg disabled:cursor-not-allowed'
        aria-label='Close settings'
      >
        <X size={22} />
      </button>
    </div>
  );

  if (permissionStep) {
    return (
      <div className='flex flex-col gap-5'>
        {header}
        <MicPermission
          live={live}
          disabled={disabled}
          href={href}
          linkTarget={linkTarget}
        />
      </div>
    );
  }

  // Only after an enumeration came back empty — not merely "list still
  // empty", which is also true for a tick after the permission prompt.
  const noDevices = live.status === 'no-device';

  return (
    <div className='flex flex-col gap-5'>
      {header}

      {noDevices ? (
        <div className='flex flex-col gap-4'>
          <Alert variant='error'>
            No audio interface found. Plug one in, then try again.
          </Alert>
          <div>
            <Button
              variant='secondary'
              onClick={() => void live.refreshDevices().then(live.connect)}
              disabled={disabled}
            >
              Refresh devices
            </Button>
          </div>
        </div>
      ) : (
        <div className='flex flex-col gap-4 w-full border border-line rounded-lg p-4'>
          <div className='flex items-center gap-3 text-fg'>
            <InterfaceIcon size={20} />
            <h4 className='font-mono font-semibold'>AUDIO INTERFACE</h4>
          </div>

          <Field
            heading='Select Interface'
            helper='Plug your instrument into Input 1 or 2 of your interface.'
          >
            {connecting ? (
              <Initializing />
            ) : (
              <NativeSelect
                ariaLabel='Audio interface'
                options={live.devices.map(d => ({
                  label: d.label,
                  value: d.deviceId,
                }))}
                value={config?.deviceId ?? ''}
                // Picking an interface connects it and unmutes (see
                // useLiveSetup.onConnected) so you hear it right away.
                onChange={live.selectDevice}
                disabled={disabled}
              />
            )}
          </Field>

          {!multi && config && isSafari && (
            <Alert variant='warning'>
              Safari hears Input 1 only. Chrome and Firefox can use more inputs.
            </Alert>
          )}
          {live.error && <Alert variant='error'>{live.error}</Alert>}

          {multi && (
            <Field
              heading='Input Channel'
              helper='Play your instrument and select the channel with signal.'
            >
              <div className='flex flex-col gap-2 mt-1'>
                {Array.from({ length: channelCount }, (_, i) => {
                  const selected = config?.channel === i;
                  return (
                    <label
                      key={i}
                      className='flex items-center gap-3 min-w-0 cursor-pointer'
                    >
                      <Radio
                        name={`t3k-input-channel-${c.playerId}`}
                        value={String(i)}
                        checked={selected}
                        onChange={() => live.selectChannel(i)}
                        disabled={disabled}
                      />
                      <span className='text-sm text-fg w-4 tabular-nums'>
                        {i + 1}
                      </span>
                      <InputMeter
                        analyser={meters?.[i] ?? null}
                        label={`Input ${i + 1} level`}
                        inactive={!selected}
                        className='flex-1 min-w-0'
                      />
                    </label>
                  );
                })}
              </div>
            </Field>
          )}
        </div>
      )}

      {/* An embed without allow="speaker-selection" can't route output;
          the picker would only ever fail, so it goes. Default output works. */}
      {speakerSelectionAllowedByPolicy() !== false && (
        <Field
          heading='Output Device'
          helper='Select where you want to hear the sound.'
        >
          {connecting ? (
            <Initializing />
          ) : (
            <NativeSelect
              ariaLabel='Output device'
              options={[
                { label: 'System Default', value: '' },
                ...live.outputDevices.map(d => ({
                  label: d.label,
                  value: d.deviceId,
                })),
              ]}
              value={live.selectedOutputDeviceId ?? ''}
              onChange={value =>
                live.setOutputDevice(value === '' ? null : value)
              }
              disabled={disabled}
            />
          )}
        </Field>
      )}

      <Field
        heading='Input Monitoring'
        helper='Hear your instrument while playing.'
      >
        <div className='flex items-center justify-between w-full px-4 py-3 border border-line rounded-lg'>
          <span className='text-fg'>Hear Yourself</span>
          <ToggleSimple
            label=''
            isChecked={hearing}
            onChange={setHearing}
            ariaLabel='Hear yourself'
            disabled={disabled || connecting || !config}
          />
        </div>
      </Field>

      <Button
        variant='primary'
        fullWidth
        className='max-w-sm mx-auto'
        onClick={onClose}
        disabled={disabled || !config}
      >
        Done
      </Button>
    </div>
  );
};
