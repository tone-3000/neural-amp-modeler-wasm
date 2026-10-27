import React, { useCallback, useEffect, useRef } from 'react';
import { KnobControl } from '../../components/ui/KnobControl';
import { InputMeter } from '../../components/ui/InputMeter';
import { ClipIndicator } from '../../components/ui/ClipIndicator';
import { useT3kPlayerContext } from '../../context/T3kPlayerContext';
import { useMeterAnimation } from '../../hooks/useMeterAnimation';

const DB_MIN = -12;
const DB_MAX = 12;
const dbToKnob = (db: number) =>
  Math.max(0, Math.min(1, (db - DB_MIN) / (DB_MAX - DB_MIN)));
const knobToDb = (knob: number) => knob * (DB_MAX - DB_MIN) + DB_MIN;

interface LiveGainProps {
  label: string;
  /** Monitoring is running, so the meter is live. */
  active: boolean;
}

/** `Input: (knob) ▮▮▮▯▯ ●` — the live counterpart of the Input select. */
export const LiveGain: React.FC<LiveGainProps> = ({ label, active }) => {
  const { getGraph, audioState, setLiveInputGain } = useT3kPlayerContext();
  const graph = getGraph();
  const config = audioState.liveInputConfig;
  const channel = config?.channel ?? 0;
  const gainDb = config?.gainsDb[channel] ?? 0;
  const analyser = active ? (graph?.inputMeter ?? null) : null;

  const meterRef = useRef<HTMLDivElement>(null);
  const clipRef = useRef<HTMLButtonElement>(null);
  const { resetClipLatch } = useMeterAnimation(
    analyser ? { analyser, meterRef, clipRef } : null,
    null,
    active
  );

  useEffect(() => {
    resetClipLatch('input');
    clipRef.current?.classList.remove('clipped');
  }, [channel, resetClipLatch]);

  const onKnob = useCallback(
    (knob: number) => setLiveInputGain(knobToDb(knob)),
    [setLiveInputGain]
  );

  return (
    <div className={`flex items-center gap-2 ${active ? '' : 'opacity-50'}`}>
      <span className='text-muted flex-shrink-0'>{label}:</span>
      <KnobControl
        label='Input gain'
        value={dbToKnob(gainDb)}
        onChange={onKnob}
        size={22}
        hideLabel
        isDisabled={!active}
        tip={`${gainDb >= 0 ? '+' : ''}${gainDb.toFixed(1)} dB`}
      />
      <div ref={meterRef} className='flex items-center gap-2 flex-1 min-w-0'>
        <InputMeter
          analyser={analyser}
          label='Input level'
          inactive={!active}
        />
        <ClipIndicator
          ref={clipRef}
          onClick={() => resetClipLatch('input')}
          size={12}
          inactive={!active}
        />
      </div>
    </div>
  );
};
