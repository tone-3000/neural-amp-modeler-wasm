import React from 'react';
import { Settings } from 'lucide-react';
import { KnobControl } from '../../components/ui/KnobControl';
import { NativeSelect } from '../../components/ui/NativeSelect';
import { ToggleSimple } from '../../components/ui/ToggleSimple';
import { PlayerController, SlotControl } from '../hooks/usePlayer';
import { LiveGain } from './LiveGain';

interface ControlsProps {
  controller: PlayerController;
  disabled?: boolean;
}

/** The mix knob's width, so its "Mix" caption can sit over it. */
const MIX_W = 'w-[22px]';

/** Wet/dry for a reverb-like IR, beside the IR's select; `50%` tip on drag. */
const MixKnob: React.FC<{
  mix: PlayerController['mix'];
  disabled: boolean;
}> = ({ mix, disabled }) => (
  <span className={`flex items-center flex-shrink-0 ${MIX_W}`}>
    <KnobControl
      label='Mix'
      value={mix.value}
      onChange={mix.set}
      size={22}
      hideLabel
      isDisabled={disabled}
      tip={`${Math.round(mix.value * 100)}%`}
    />
  </span>
);

/**
 * The tone controls: primary select + on/off toggle, then an inline line
 * with the source (Input select, or live gain) and the companion select.
 * A reverb-like IR gets a mix knob next to its select. Live stacks: gain
 * row + settings gear, device name, then the companion. One code path for
 * demo and live, single tones and playlists.
 */
export const Controls: React.FC<ControlsProps> = ({
  controller: c,
  disabled = false,
}) => {
  const isLive = c.sourceMode === 'live';
  const device = isLive
    ? c.live.devices.find(d => d.deviceId === c.live.config?.deviceId)
    : undefined;
  const dim = c.bypassed ? 'opacity-50 grayscale' : '';
  const selectsDisabled = disabled || c.bypassed;

  const select = (slot: SlotControl, inline: boolean) => (
    <NativeSelect
      variant={inline ? 'inline' : 'field'}
      options={slot.options}
      label={inline ? `${c.labels.secondary}:` : undefined}
      ariaLabel={c.labels.primary}
      value={slot.value}
      onChange={slot.set}
      disabled={selectsDisabled}
    />
  );
  const mixKnob = c.mix.show ? (
    <MixKnob mix={c.mix} disabled={selectsDisabled} />
  ) : null;
  const mixOn = (slot: SlotControl) => (slot.field === 'ir' ? mixKnob : null);

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex flex-col gap-1'>
        {/* Same gap as the control row below, so each caption sits over
            its control: "Mix" over the knob (when shown), "Tone on" over
            the toggle. */}
        <div className='flex items-end gap-4 text-sm text-muted'>
          <span className={`flex-1 min-w-0 truncate ${dim}`}>
            {c.labels.primary}
          </span>
          {mixOn(c.primary) && (
            // As wide as the knob and centred on it; the text overhangs.
            <span
              className={`${MIX_W} flex-shrink-0 flex justify-center whitespace-nowrap ${dim}`}
            >
              Mix
            </span>
          )}
          {/* As wide as the toggle (w-10) and centred on it; the text
              overhangs evenly into the panel padding. */}
          <span className='w-10 flex-shrink-0 flex justify-center whitespace-nowrap'>
            {c.bypassed ? 'Tone off' : 'Tone on'}
          </span>
        </div>
        <div className='flex items-center gap-4'>
          <div className={`flex-1 min-w-0 ${dim}`}>
            {select(c.primary, false)}
          </div>
          {mixOn(c.primary) && <span className={dim}>{mixOn(c.primary)}</span>}
          <ToggleSimple
            label=''
            onChange={c.toggleBypass}
            isChecked={!c.bypassed}
            ariaLabel='Tone on'
            disabled={disabled}
          />
        </div>
      </div>

      {isLive ? (
        // Live stacks: a bordered input group (gain row, interface name
        // under it) in the select's column with the settings gear beside it
        // in the toggle's column, then the companion.
        <div className='flex flex-col gap-2 text-sm min-w-0'>
          <div className='flex items-center gap-4'>
            <div className='flex-1 min-w-0 flex flex-col gap-1 border border-line rounded-md px-4 py-3'>
              <LiveGain label={c.labels.input} active={c.isActive} />
              <div className='flex items-center gap-x-2 text-xs text-muted min-w-0'>
                <span className='truncate'>{device?.label ?? 'Interface'}</span>
                {c.live.config && (c.live.config.channelCount ?? 0) >= 2 && (
                  <span className='flex-shrink-0'>
                    Input {c.live.config.channel + 1}
                  </span>
                )}
              </div>
            </div>
            <button
              type='button'
              onClick={() => c.setView('settings')}
              disabled={disabled}
              className='w-10 flex-shrink-0 flex justify-center p-1 rounded text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-fg disabled:cursor-not-allowed disabled:opacity-50'
              aria-label='Audio settings'
            >
              <Settings size={24} />
            </button>
          </div>
          <span className={`min-w-0 flex items-center gap-3 ${dim}`}>
            {select(c.companion, true)}
            {mixOn(c.companion)}
          </span>
        </div>
      ) : (
        // Demo: `.t3k-inline-row` is one truncating row, or two stacked rows
        // under ~380px — decided by the player's width, never by the option
        // text, so it's the same height as `ControlsSkeleton`.
        <div className='t3k-inline-row flex flex-nowrap items-center gap-x-5 gap-y-1 text-sm min-w-0'>
          <NativeSelect
            variant='inline'
            options={c.inputOptions}
            label={`${c.labels.input}:`}
            value={c.selection?.input.url ?? ''}
            onChange={c.setInput}
            disabled={disabled}
          />
          <span className={`min-w-0 flex items-center gap-3 ${dim}`}>
            {select(c.companion, true)}
            {mixOn(c.companion)}
          </span>
        </div>
      )}
    </div>
  );
};
