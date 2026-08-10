/**
 * Message protocol between NamEngine (main thread) and the NAM worklet
 * processor (audio thread). Every request carries a requestId and receives
 * exactly one response.
 */

/** Metadata about the currently loaded model, reported after a load. */
export interface NamModelInfo {
  /** Whether the model supports dynamic size reduction (e.g. A2 models). */
  slimmable: boolean;
  /**
   * Internal slimmable-size breakpoints in (0.0, 1.0), ascending. A slimSize
   * below a breakpoint selects the smaller submodel on that side of it
   * (NAM core semantics: each submodel covers values up to, but not
   * including, its max_value). Empty for non-slimmable models.
   */
  slimmableBreakpoints: number[];
  /** Whether the model reports its own loudness (normalized to -18 dB). */
  hasLoudness: boolean;
  /** Model's self-reported loudness in dB (0 when unknown). */
  loudness: number;
  /** Sample rate the model was trained at, in Hz (-1 when unknown). */
  expectedSampleRate: number;
}

/** Requests: main thread -> worklet. */
export type NamWorkletRequest =
  | {
      type: 'init';
      requestId: number;
      /** Compiled wasm binary; the worklet scope has no fetch. */
      wasmBytes: ArrayBuffer;
    }
  | {
      type: 'load-model';
      requestId: number;
      /** Contents of a .nam file (JSON). */
      json: string;
      /** Raw NAM-core slimmable size; negative = full model. */
      slimSize: number;
    }
  | { type: 'unload-model'; requestId: number }
  | { type: 'set-slim-size'; requestId: number; slimSize: number }
  | {
      /**
       * Destroy the wasm instance and stop the processor for good (its
       * process() returns false afterwards, letting the browser collect it).
       */
      type: 'destroy';
      requestId: number;
    };

/** Responses: worklet -> main thread. */
export type NamWorkletResponse =
  | { type: 'response'; requestId: number; ok: true; modelInfo?: NamModelInfo }
  | { type: 'response'; requestId: number; ok: false; error: string };

/** Name under which the processor is registered in the worklet scope. */
export const NAM_PROCESSOR_NAME = 'nam-processor';
