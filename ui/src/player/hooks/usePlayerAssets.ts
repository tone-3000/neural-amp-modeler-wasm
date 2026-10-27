import { Dispatch, useCallback, useEffect, useRef } from 'react';
import { PlayerAssets, PlayerTone } from '../../types';
import { PlayerAction, PlayerState } from '../state/playerReducer';

/**
 * Resolves a tone's assets on demand. Eager assets return immediately; thunks
 * run once per tone (concurrent callers share the in-flight promise) and
 * their outcome is written to state.
 */
export function usePlayerAssets(
  tones: PlayerTone[],
  state: PlayerState,
  dispatch: Dispatch<PlayerAction>
) {
  const tonesRef = useRef(tones);
  tonesRef.current = tones;
  const stateRef = useRef(state);
  stateRef.current = state;
  const inflight = useRef(new Map<string, Promise<PlayerAssets>>());

  // Keep the reducer's tone table in step with the prop.
  const idsKey = tones.map(t => t.id).join('\u0000');
  useEffect(() => {
    dispatch({ type: 'tones/sync', tones: tonesRef.current });
  }, [idsKey, dispatch]);

  const resolveAssets = useCallback(
    (toneId: string): Promise<PlayerAssets> => {
      const current = stateRef.current.assets[toneId];
      if (current?.status === 'ready') return Promise.resolve(current.value);

      const pending = inflight.current.get(toneId);
      if (pending) return pending;

      const tone = tonesRef.current.find(t => t.id === toneId);
      if (!tone) {
        return Promise.reject(new Error(`Unknown tone "${toneId}"`));
      }
      if (typeof tone.assets !== 'function') {
        dispatch({ type: 'assets/ready', toneId, assets: tone.assets });
        return Promise.resolve(tone.assets);
      }

      dispatch({ type: 'assets/loading', toneId });
      const promise = tone
        .assets()
        .then(assets => {
          validateAssets(assets);
          dispatch({ type: 'assets/ready', toneId, assets });
          return assets;
        })
        .catch((error: unknown) => {
          const message =
            error instanceof Error ? error.message : 'Failed to load tone';
          dispatch({ type: 'assets/error', toneId, message });
          throw error;
        })
        .finally(() => {
          inflight.current.delete(toneId);
        });
      inflight.current.set(toneId, promise);
      return promise;
    },
    [dispatch]
  );

  return { resolveAssets };
}

function validateAssets(assets: PlayerAssets): void {
  if (
    !assets?.models?.length ||
    !assets?.irs?.length ||
    !assets?.inputs?.length
  ) {
    throw new Error('Tone has no playable models, IRs, or inputs');
  }
}
