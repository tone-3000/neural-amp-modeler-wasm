// Node smoke test for the NAM wasm engine (no browser required).
//
// Verifies the multi-instance C API end to end: instance lifecycle, model
// loading (A1 + A2, slimmed and full), processing sane audio, error handling
// on bad input, and that repeated model switches don't grow the heap.
//
// Usage: node tools/smoke/nam-engine-smoke.mjs
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const enginePath = path.join(root, 'ui/src/engine/wasm/nam-engine.js');
const wasmPath = path.join(root, 'ui/src/engine/wasm/nam-engine.wasm');

const MODELS = {
  a1: path.join(root, 'ui/public/models/deluxe.nam'),
  a2: path.join(root, 'ui/public/models/deluxe-a2.nam'),
};

const SAMPLE_RATE = 48000;
const FRAMES = 128;

let failures = 0;
function check(name, ok, detail = '') {
  const status = ok ? 'ok  ' : 'FAIL';
  console.log(`${status} ${name}${detail ? ` (${detail})` : ''}`);
  if (!ok) failures++;
}

function loadModel(M, id, json, slimSize = -1) {
  const len = M.lengthBytesUTF8(json) + 1;
  const ptr = M._malloc(len);
  M.stringToUTF8(json, ptr, len);
  const ok = M._nam_loadModel(id, ptr, slimSize);
  M._free(ptr);
  return !!ok;
}

// Process one second of a 220 Hz sine, return output RMS.
function processSeconds(M, id, seconds = 1) {
  const bufPtr = M._nam_getBuffer(id);
  let sumSquares = 0;
  let n = 0;
  const totalFrames = Math.floor((SAMPLE_RATE * seconds) / FRAMES) * FRAMES;
  for (let start = 0; start < totalFrames; start += FRAMES) {
    // Re-derive the heap view every block: memory growth detaches old views.
    const buf = M.HEAPF32.subarray(bufPtr >> 2, (bufPtr >> 2) + FRAMES);
    for (let i = 0; i < FRAMES; i++) {
      buf[i] = 0.5 * Math.sin((2 * Math.PI * 220 * (start + i)) / SAMPLE_RATE);
    }
    M._nam_process(id, FRAMES);
    const out = M.HEAPF32.subarray(bufPtr >> 2, (bufPtr >> 2) + FRAMES);
    for (let i = 0; i < FRAMES; i++) {
      if (!Number.isFinite(out[i])) throw new Error('non-finite output sample');
      sumSquares += out[i] * out[i];
      n++;
    }
  }
  return Math.sqrt(sumSquares / n);
}

const createNamEngine = (await import(enginePath)).default;
const M = await createNamEngine({ wasmBinary: await readFile(wasmPath) });

check('module version', M.UTF8ToString(M._nam_getVersion()) === '0.5.4', M.UTF8ToString(M._nam_getVersion()));

const a1Json = await readFile(MODELS.a1, 'utf8');
const a2Json = await readFile(MODELS.a2, 'utf8');

// Instance lifecycle
const a = M._nam_createInstance(SAMPLE_RATE, FRAMES);
const b = M._nam_createInstance(SAMPLE_RATE, FRAMES);
check('distinct instance ids', a > 0 && b > 0 && a !== b, `a=${a} b=${b}`);
check('no model yet', M._nam_hasModel(a) === 0);

// Pass-through without a model
{
  const rms = processSeconds(M, a, 0.1);
  check('pass-through without model', Math.abs(rms - 0.5 / Math.SQRT2) < 1e-3, `rms=${rms.toFixed(4)}`);
}

// Load + process A1
check('load A1', loadModel(M, a, a1Json));
check('A1 hasModel', M._nam_hasModel(a) === 1);
check('A1 not slimmable', M._nam_isSlimmable(a) === 0);
{
  const rms = processSeconds(M, a);
  check('A1 output audible', rms > 0.01 && rms < 10, `rms=${rms.toFixed(4)}`);
}

// Load + process A2 (full and slimmed) on a second, independent instance
check('load A2 full', loadModel(M, b, a2Json));
check('A2 slimmable', M._nam_isSlimmable(b) === 1);
{
  const count = M._nam_getSlimmableBreakpointCount(b);
  const breakpoints = [];
  for (let i = 0; i < count; i++) breakpoints.push(M._nam_getSlimmableBreakpoint(b, i).toFixed(2));
  check('A2 breakpoints reported', count > 0, `[${breakpoints.join(', ')}]`);
}
const rmsFull = processSeconds(M, b);
check('A2 full output audible', rmsFull > 0.01 && rmsFull < 10, `rms=${rmsFull.toFixed(4)}`);

check('load A2 slim 0.5', loadModel(M, b, a2Json, 0.5));
const rmsSlim = processSeconds(M, b);
check('A2 slim output audible', rmsSlim > 0.01 && rmsSlim < 10, `rms=${rmsSlim.toFixed(4)}`);

// Live re-slim without reparse.
M._nam_setSlimmableSize(b, 0.0);
{
  const rms = processSeconds(M, b, 0.25);
  check('A2 re-slim to 0.0 processes', rms > 0.001, `rms=${rms.toFixed(4)}`);
}

// Instance independence: A stays on A1 while B ran A2
check('A still has model', M._nam_hasModel(a) === 1);

// Loudness introspection
{
  const has = M._nam_hasLoudness(a);
  const loudness = M._nam_getLoudness(a);
  check('loudness introspection callable', has === 0 || Number.isFinite(loudness), `has=${has} loudness=${loudness.toFixed(1)}`);
}

// Bad model JSON fails cleanly, engine keeps working
{
  const ok = loadModel(M, a, '{"not": "a nam file"}');
  const err = M.UTF8ToString(M._nam_getLastError());
  check('bad JSON rejected', !ok, err.slice(0, 60));
  check('previous model survives failed load', M._nam_hasModel(a) === 1);
  const rms = processSeconds(M, a, 0.1);
  check('processing still works after failed load', rms > 0.01, `rms=${rms.toFixed(4)}`);
}

// Unload returns the instance to pass-through
M._nam_unloadModel(b);
check('unload clears model', M._nam_hasModel(b) === 0);
{
  const rms = processSeconds(M, b, 0.1);
  check('pass-through after unload', Math.abs(rms - 0.5 / Math.SQRT2) < 1e-3, `rms=${rms.toFixed(4)}`);
}

// Leak check: repeated model switches must not grow the heap
{
  // Warm up so one-time growth (buffers sized to the biggest model) is done.
  for (let i = 0; i < 3; i++) {
    loadModel(M, a, a2Json);
    loadModel(M, a, a1Json);
  }
  const heapBefore = M.HEAPU8.length;
  for (let i = 0; i < 20; i++) {
    loadModel(M, a, i % 2 === 0 ? a2Json : a1Json);
    processSeconds(M, a, 0.05);
  }
  const heapAfter = M.HEAPU8.length;
  check('heap stable across 20 model switches', heapAfter === heapBefore, `${(heapBefore / 1048576).toFixed(0)}MB -> ${(heapAfter / 1048576).toFixed(0)}MB`);
}

// Destroy
M._nam_destroyInstance(a);
M._nam_destroyInstance(b);
check('destroyed instance rejects load', loadModel(M, a, a1Json) === false);

console.log(failures === 0 ? '\nAll smoke tests passed' : `\n${failures} smoke test(s) FAILED`);
process.exit(failures === 0 ? 0 : 1);
