import { useCallback, useEffect, useRef, useState } from 'react';
import { useT3kPlayerContext } from '../../context/T3kPlayerContext';
import {
  AudioInputDevice,
  AudioOutputDevice,
  ChannelSelection,
  LiveInputConfig,
  MicrophonePermissionStatus,
} from '../../types';

/**
 * Where the Live tab is in getting an instrument connected. One screen per
 * status; the panel renders them inline (no dialog).
 */
export type LiveStatus =
  | 'connect' // nothing yet, or a retryable failure: show the Connect button
  | 'pending' // browser permission prompt is open
  | 'blocked' // permission denied permanently; show per-browser steps
  | 'connecting' // enumerating devices / starting the input / engine init
  | 'no-device' // permission granted, no audio inputs found
  | 'ready'; // an interface is configured

export interface LiveSetup {
  status: LiveStatus;
  permission: MicrophonePermissionStatus;
  /** Permission, enumeration or connection error for the current status. */
  error: string | null;
  config: LiveInputConfig | null;
  devices: AudioInputDevice[];
  outputDevices: AudioOutputDevice[];
  selectedOutputDeviceId: string | null;
  /** Ask for permission (if needed), find the interface, connect it. */
  connect: () => Promise<void>;
  refreshDevices: () => Promise<void>;
  selectDevice: (deviceId: string) => Promise<void>;
  selectChannel: (channel: ChannelSelection) => void;
  setOutputDevice: (deviceId: string | null) => Promise<void>;
}

interface Options {
  /** Run the flow (the Live tab is showing). */
  enabled: boolean;
  /** Called after an interface connects, so the caller can start monitoring. */
  onConnected?: () => void | Promise<void>;
}

// Several players share one engine; only one of them should run the
// permission → devices → connect sequence at a time.
let inFlight: Promise<void> | null = null;

export function useLiveSetup({ enabled, onConnected }: Options): LiveSetup {
  const {
    audioState,
    microphonePermission,
    audioInputDevices,
    audioOutputDevices,
    init,
    requestMicrophonePermission,
    refreshAudioInputDevices,
    refreshAudioOutputDevices,
    startLiveInput,
    selectLiveInputChannel,
    setOutputDevice,
  } = useT3kPlayerContext();

  const [busy, setBusy] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const enumeratedRef = useRef(false);
  const autoTriedRef = useRef(false);
  const onConnectedRef = useRef(onConnected);
  onConnectedRef.current = onConnected;

  const config = audioState.liveInputConfig;
  const permission = microphonePermission.status;

  /**
   * Enumerate, then start `deviceId` (or the preferred / first interface).
   * Always enumerates: right after the permission prompt the device list is
   * still empty, and the settings panel needs it populated.
   */
  const connectDevice = useCallback(
    async (deviceId?: string): Promise<void> => {
      setConnectionError(null);
      setBusy(true);
      try {
        await init();
        const [{ inputDevices, preferredDeviceId }] = await Promise.all([
          refreshAudioInputDevices(),
          refreshAudioOutputDevices(),
        ]);
        enumeratedRef.current = true;
        if (inputDevices.length === 0) return;
        const known = (id?: string | null) =>
          id && inputDevices.some(d => d.deviceId === id) ? id : null;
        const id =
          known(deviceId) ??
          known(preferredDeviceId) ??
          inputDevices[0].deviceId;
        await startLiveInput(id);
        await onConnectedRef.current?.();
      } catch (error) {
        setConnectionError(
          error instanceof DOMException
            ? error.message
            : 'Could not connect to the audio interface. Try again.'
        );
      } finally {
        setBusy(false);
      }
    },
    [init, refreshAudioInputDevices, refreshAudioOutputDevices, startLiveInput]
  );

  const runOnce = useCallback((task: () => Promise<void>): Promise<void> => {
    if (inFlight) return inFlight;
    inFlight = task().finally(() => {
      inFlight = null;
    });
    return inFlight;
  }, []);

  const connect = useCallback(
    () =>
      runOnce(async () => {
        if (permission !== 'granted') {
          let preferred: string | null;
          try {
            preferred = await requestMicrophonePermission();
          } catch {
            return; // status/error are in microphonePermission
          }
          await connectDevice(preferred ?? undefined);
        } else {
          await connectDevice();
        }
      }),
    [runOnce, permission, requestMicrophonePermission, connectDevice]
  );

  // Permission already granted and no interface yet: connect without asking.
  useEffect(() => {
    if (!enabled || permission !== 'granted' || config || busy) return;
    if (autoTriedRef.current) return;
    autoTriedRef.current = true;
    void runOnce(connectDevice);
  }, [enabled, permission, config, busy, runOnce, connectDevice]);

  const refreshDevices = useCallback(async () => {
    await Promise.all([
      refreshAudioInputDevices(),
      refreshAudioOutputDevices(),
    ]);
    enumeratedRef.current = true;
    autoTriedRef.current = false; // let the auto-connect retry with new devices
  }, [refreshAudioInputDevices, refreshAudioOutputDevices]);

  const selectDevice = useCallback(
    (deviceId: string) => runOnce(() => connectDevice(deviceId)),
    [runOnce, connectDevice]
  );

  const devices = audioInputDevices.devices;
  const connecting =
    busy ||
    audioInputDevices.isLoading ||
    audioState.inputMode.type === 'connecting';

  let status: LiveStatus;
  if (permission === 'pending') status = 'pending';
  else if (permission === 'blocked') status = 'blocked';
  else if (connecting) status = 'connecting';
  else if (config) status = 'ready';
  else if (permission === 'granted' && enumeratedRef.current && !devices.length)
    status = 'no-device';
  else status = 'connect';

  const error =
    connectionError ??
    (status === 'connect' || status === 'blocked'
      ? microphonePermission.error
      : null) ??
    audioInputDevices.error;

  return {
    status,
    permission,
    error,
    config,
    devices,
    outputDevices: audioOutputDevices.devices,
    selectedOutputDeviceId: audioOutputDevices.selectedDeviceId,
    connect,
    refreshDevices,
    selectDevice,
    selectChannel: selectLiveInputChannel,
    setOutputDevice,
  };
}
