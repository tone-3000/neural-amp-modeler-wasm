import React, {
  createContext,
  useContext,
  useRef,
  useState,
  ReactNode,
  useCallback,
} from 'react';
import { useModule } from '../hooks/useModule';
import { readProfile } from '../utils/readProfile';
import { DEFAULT_AUDIO_SRC } from '../constants';

interface T3kPlayerContextType {
  audioContext: AudioContext | null;
  audioElement: HTMLAudioElement | null;
  audioWorkletNode: AudioWorkletNode | null;
  inputGainNode: GainNode | null;
  outputGainNode: GainNode | null;
  bypassNode: GainNode | null;
  irNode: ConvolverNode | null;
  loadProfile: (
    modelUrl: string,
  ) => Promise<void>;
  loadAudio: (src: string) => void;
  toggleBypass: () => void;
  isProfileLoaded: boolean;
  cleanup: () => void;
  loadIr: (
    irUrl: string,
    wetAmount?: number,
    gainAmount?: number
  ) => Promise<void>;
  removeIr: () => void;
  isIrLoaded: boolean;
  init: () => void;
}

const T3kPlayerContext = createContext<T3kPlayerContextType | null>(null);

export function T3kPlayerContextProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [audioWorkletNode, setAudioWorkletNode] =
    useState<AudioWorkletNode | null>(null);
  const [isProfileLoaded, setIsProfileLoaded] = useState(false);
  const [irNode, setIrNode] = useState<ConvolverNode | null>(null);
  const [isIrLoaded, setIsIrLoaded] = useState(false);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const inputGainNodeRef = useRef<GainNode | null>(null);
  const outputGainNodeRef = useRef<GainNode | null>(null);
  const bypassNodeRef = useRef<GainNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const modulePromise = useModule();
  const [isInitialized, setIsInitialized] = useState(false);

  // Add ref for IR wet gain node
  const irWetGainRef = useRef<GainNode | null>(null);
  const irDryGainRef = useRef<GainNode | null>(null);

  // Add ref for IR gain node
  const irGainRef = useRef<GainNode | null>(null);

  const init = () => {
    if (isInitialized) return;
    if (typeof window !== 'undefined') {
      if (!window.AudioContext || !window.AudioWorklet) {
        console.error('AudioWorklet not supported in this browser');
        return;
      }
    }
    // Create hidden audio element
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audioElementRef.current = audio;
    document.body.appendChild(audio);

    audio.src = DEFAULT_AUDIO_SRC;
    audio.load();

    // Initialize audio context and nodes
    const script = document.createElement('script');
      script.src = '/t3k-wasm-module.js';
      script.async = true;

      script.onerror = error => {
        console.error(
          'Failed to load t3k-wasm-module.js:',
          JSON.stringify(error)
        );
      };

      document.body.appendChild(script);

      // @ts-ignore
      window.wasmAudioWorkletCreated = (
        node1: AudioWorkletNode,
        node2: AudioContext
      ) => {
        const audioWorkletNode = node1;
        const context = node2;

        setAudioWorkletNode(audioWorkletNode);
        setAudioContext(context);
        context.resume();

        // Setup gain nodes
        inputGainNodeRef.current = new GainNode(context, { gain: 1 });
        outputGainNodeRef.current = new GainNode(context, { gain: 1 });
        bypassNodeRef.current = new GainNode(context, { gain: 0 });

        // Create and store source node
        sourceNodeRef.current = context.createMediaElementSource(
          audioElementRef.current!
        );

        // Connect nodes
        sourceNodeRef.current.connect(inputGainNodeRef.current);
        inputGainNodeRef.current.connect(bypassNodeRef.current);
        bypassNodeRef.current.connect(outputGainNodeRef.current);
        inputGainNodeRef.current.connect(audioWorkletNode);
        audioWorkletNode.connect(outputGainNodeRef.current);
        outputGainNodeRef.current.connect(context.destination);
      };

      setIsInitialized(true);
  }

  const loadProfile = async (modelUrl: string) => {
    try {
      const res = await fetch(modelUrl);
      const blob = await res.blob();
      const file = new File([blob], 'profile.nam', { type: '.nam' });
      const jsonStr = (await readProfile(file)) as string;

      if (!jsonStr) {
        console.error('Failed to read profile - jsonStr is empty');
        return;
      }

      if (!modulePromise) {
        console.error('No modulePromise available');
        return;
      }

      const module = await modulePromise();

      if (!module || !module._malloc || !module.stringToUTF8 || !module.ccall) {
        console.error('Module missing required functions');
        return;
      }

      const ptr = module._malloc(jsonStr.length + 1);
      module.stringToUTF8(jsonStr, ptr, jsonStr.length + 1);

      try {
        if (audioContext?.state === 'running') {
          await audioContext.suspend();
        }

        await module.ccall('setDsp', null, ['number'], [ptr], { async: true });
        module._free(ptr);

        if (audioContext?.state === 'suspended') {
          await audioContext.resume();
        }

        setIsProfileLoaded(true);
      } catch (error) {
        console.error('Error in setDsp flow:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error in loadProfile:', error);
    }
  };

  const loadAudio = (src: string) => {
    if (audioElementRef.current) {
      audioElementRef.current.src = src;
      audioElementRef.current.load();
    } else {
      console.warn('audioElementRef.current is not ready');
    }
  };

  const loadIr = useCallback(
    async (irUrl: string, wetAmount: number = 1, gainAmount: number = 1) => {
      if (!audioContext || !audioWorkletNode || !outputGainNodeRef.current)
        return;

      try {
        // Create/update wet/dry mix nodes
        if (!irWetGainRef.current) {
          irWetGainRef.current = new GainNode(audioContext, {
            gain: wetAmount,
          });
        } else {
          irWetGainRef.current.gain.setValueAtTime(
            wetAmount,
            audioContext.currentTime
          );
        }
        if (!irDryGainRef.current) {
          irDryGainRef.current = new GainNode(audioContext, {
            gain: 1 - wetAmount,
          });
        } else {
          irDryGainRef.current.gain.setValueAtTime(
            1 - wetAmount,
            audioContext.currentTime
          );
        }

        // Create/update IR gain node
        if (!irGainRef.current) {
          irGainRef.current = new GainNode(audioContext, { gain: gainAmount });
        } else {
          irGainRef.current.gain.setValueAtTime(
            gainAmount,
            audioContext.currentTime
          );
        }

        // Create new convolver node
        const newIrNode = new ConvolverNode(audioContext);

        // Fetch and decode the IR file
        const response = await fetch(irUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        newIrNode.buffer = audioBuffer;

        // Disconnect existing routing
        audioWorkletNode.disconnect();
        irNode?.disconnect();
        irWetGainRef.current.disconnect();
        irDryGainRef.current.disconnect();

        // Connect parallel paths:
        // 1. Wet path: worklet -> IR -> wet gain -> output
        // 2. Dry path: worklet -> dry gain -> output
        audioWorkletNode.connect(newIrNode);
        newIrNode.connect(irGainRef.current);
        irGainRef.current.connect(irWetGainRef.current);
        irWetGainRef.current.connect(outputGainNodeRef.current);

        audioWorkletNode.connect(irDryGainRef.current);
        irDryGainRef.current.connect(outputGainNodeRef.current);

        setIrNode(newIrNode);
        setIsIrLoaded(true);
      } catch (error) {
        console.error('Error loading IR:', error);
      }
    },
    [audioContext, audioWorkletNode, outputGainNodeRef]
  );

  const removeIr = () => {
    if (!audioWorkletNode || !outputGainNodeRef.current) return;

    // Disconnect all IR-related nodes
    audioWorkletNode.disconnect();
    irNode?.disconnect();
    irWetGainRef.current?.disconnect();
    irDryGainRef.current?.disconnect();

    // Connect directly without IR
    audioWorkletNode.connect(outputGainNodeRef.current);
    setIsIrLoaded(false);
    setIrNode(null);
  };

  const cleanup = () => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
    }

    // Disconnect all IR-related nodes and reset them
    if (audioWorkletNode && outputGainNodeRef.current) {
      audioWorkletNode.disconnect();
      irNode?.disconnect();
      irWetGainRef.current?.disconnect();
      irDryGainRef.current?.disconnect();
      irGainRef.current?.disconnect();

      // Reset IR nodes
      irNode?.disconnect();
      setIrNode(null);
      irWetGainRef.current = null;
      irDryGainRef.current = null;
      irGainRef.current = null;

      // Reconnect basic audio path
      audioWorkletNode.connect(outputGainNodeRef.current);
      setIsIrLoaded(false);
    }

    setIsProfileLoaded(false);
  };

  const toggleBypass = () => {
    if (!audioWorkletNode || !bypassNodeRef.current) return;

    if (bypassNodeRef.current.gain.value === 0) {
      try {
        // When bypassing
        if (
          irNode &&
          irWetGainRef.current &&
          irDryGainRef.current &&
          irGainRef.current
        ) {
          // If IR is present, disconnect both wet and dry paths
          audioWorkletNode.disconnect(irNode);
          audioWorkletNode.disconnect(irDryGainRef.current);
          irNode.disconnect(irGainRef.current);
          irGainRef.current.disconnect(irWetGainRef.current);
          irWetGainRef.current.disconnect(outputGainNodeRef.current!);
          irDryGainRef.current.disconnect(outputGainNodeRef.current!);
        } else {
          // Normal bypass without IR
          audioWorkletNode.disconnect(outputGainNodeRef.current!);
        }
        bypassNodeRef.current.gain.setValueAtTime(1, audioContext!.currentTime);
      } catch (e) {
        console.log('Bypass disconnect error:', e);
      }
    } else {
      try {
        // When un-bypassing
        if (
          irNode &&
          irWetGainRef.current &&
          irDryGainRef.current &&
          irGainRef.current
        ) {
          // If IR is present, reconnect both wet and dry paths
          audioWorkletNode.connect(irNode);
          irNode.connect(irGainRef.current);
          irGainRef.current.connect(irWetGainRef.current);
          irWetGainRef.current.connect(outputGainNodeRef.current!);
          audioWorkletNode.connect(irDryGainRef.current);
          irDryGainRef.current.connect(outputGainNodeRef.current!);
        } else {
          // Normal un-bypass without IR
          audioWorkletNode.connect(outputGainNodeRef.current!);
        }
        bypassNodeRef.current.gain.setValueAtTime(0, audioContext!.currentTime);
      } catch (e) {
        console.log('Bypass connect error:', e);
      }
    }
  };

  const value = {
    audioContext,
    audioElement: audioElementRef.current,
    audioWorkletNode,
    inputGainNode: inputGainNodeRef.current,
    outputGainNode: outputGainNodeRef.current,
    bypassNode: bypassNodeRef.current,
    irNode,
    loadProfile,
    loadAudio,
    toggleBypass,
    isProfileLoaded,
    cleanup,
    loadIr,
    removeIr,
    isIrLoaded,
    init,
  };

  return (
    <T3kPlayerContext.Provider value={value}>
      {children}
    </T3kPlayerContext.Provider>
  );
}

export const useT3kPlayerContext = () => {
  if (typeof window === 'undefined') {
    // Return sensible defaults for SSR
    return {
      audioContext: null,
      audioElement: null,
      audioWorkletNode: null,
      inputGainNode: null,
      outputGainNode: null,
      bypassNode: null,
      irNode: null,
      loadProfile: async () => {},
      loadAudio: () => {},
      toggleBypass: () => {},
      isProfileLoaded: false,
      cleanup: () => {},
      loadIr: async () => {},
      removeIr: () => {},
      isIrLoaded: false,
      init: () => {},
    };
  }
  const context = useContext(T3kPlayerContext);
  if (!context) {
    throw new Error(
      'useT3kPlayerContext must be used within a T3kPlayerContextProvider'
    );
  }
  return context;
};
