# Changelog

## 2.0.0

Complete rewrite of the WASM engine and its JavaScript integration. The
architecture is inspired by [openDAW](https://github.com/andremichelle/openDAW)'s
NAM integration: a small single-threaded wasm module instantiated inside a
hand-written AudioWorklet processor, instead of Emscripten's
`-sAUDIO_WORKLET`/pthreads/SharedArrayBuffer machinery.

### Why

On iOS, the v1 engine crashed the tab (Jetsam kill) a few seconds into
playback: instantiating the threaded wasm module a second time on the audio
worklet thread triggered a WebKit wasm recompile storm that spiked the
process's physical footprint past the ~1.5 GB tab limit. The v2 architecture
eliminates the second instantiation entirely. Measured physical footprint
during playback with live A1/A2 model switching dropped from ~450–570 MB peaks
to ~50–75 MB.

### Breaking changes

- **No COOP/COEP required.** The engine no longer uses SharedArrayBuffer, so
  sites no longer need `Cross-Origin-Embedder-Policy` /
  `Cross-Origin-Opener-Policy` headers or a cross-origin isolation gate.
- **No script tag / public wasm files.** `t3k-wasm-module.{js,wasm,worker.js,aw.js,ww.js}`
  are gone. The engine assets (`nam-worklet.js`, `nam-engine.wasm`) ship inside
  the npm package and are resolved automatically via `import.meta.url`
  (override with the `engineAssets` prop on `T3kPlayerProvider` if your
  bundler needs it).
- **`forceA2Nano: boolean` prop replaced by `slimSize?: number`.** Pass the raw
  NAM-core slimmable size in `[0.0, 1.0]` (e.g. `0.5`); omit for full size.
  Non-slimmable models ignore it.
- **New public engine API.** `NamEngine`, `NamNode`, and `NamNodePool` are
  exported from `neural-amp-modeler-wasm/engine` for non-React consumers.

### Other changes

- NAM core updated to v0.5.4 (A2 model support with `a2_fast_path`, slimmable
  models) and Eigen to 5.0.1.
- Initial wasm heap is 64 MB (grows on demand, 512 MB max) instead of a fixed
  1 GB shared allocation.
- Model files load as JSON strings through a typed message port protocol; a
  failed load reports an error cleanly instead of aborting the module.
- Output ramps down during a model swap and fades back in after (no clicks).
- Multiple independent NAM instances are supported inside one module
  (`NamEngine.createNode()` per instance).
