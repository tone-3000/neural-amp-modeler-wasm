/**
 * Type declarations for the Emscripten-generated glue (nam-engine.js).
 * The glue and nam-engine.wasm are produced by wasm/build.bash.
 */

export interface NamEngineModule {
  HEAPU8: Uint8Array;
  HEAPF32: Float32Array;

  _malloc(size: number): number;
  _free(ptr: number): void;
  stringToUTF8(str: string, ptr: number, maxBytes: number): number;
  lengthBytesUTF8(str: string): number;
  UTF8ToString(ptr: number): string;

  _nam_createInstance(sampleRate: number, maxFrames: number): number;
  _nam_destroyInstance(id: number): void;
  _nam_loadModel(id: number, jsonPtr: number, slimSize: number): number;
  _nam_unloadModel(id: number): void;
  _nam_hasModel(id: number): number;
  _nam_getBuffer(id: number): number;
  _nam_process(id: number, frames: number): void;
  _nam_isSlimmable(id: number): number;
  _nam_setSlimmableSize(id: number, slimSize: number): void;
  _nam_getSlimmableBreakpointCount(id: number): number;
  _nam_getSlimmableBreakpoint(id: number, index: number): number;
  _nam_hasLoudness(id: number): number;
  _nam_getLoudness(id: number): number;
  _nam_getExpectedSampleRate(id: number): number;
  _nam_getLastError(): number;
  _nam_getVersion(): number;
}

export interface NamEngineModuleOptions {
  wasmBinary?: ArrayBuffer | Uint8Array;
  locateFile?: (path: string, scriptDirectory: string) => string;
}

declare function createNamEngine(
  options?: NamEngineModuleOptions
): Promise<NamEngineModule>;

export default createNamEngine;
