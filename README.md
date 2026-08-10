# Neural Amp Modeler Wasm

[![npm version](https://img.shields.io/npm/v/neural-amp-modeler-wasm.svg)](https://www.npmjs.com/package/neural-amp-modeler-wasm)

This is a [TONE3000](https://tone3000.com) fork of [Steve Atkinson's Neural Amp Modeler Core](https://github.com/sdatkinson/NeuralAmpModelerCore) DSP library, adapted to run Neural Amp Modeler inference in web browsers using WebAssembly. This enables real-time audio amp modeling directly in the browser without native plugins.

![screenshot](https://raw.githubusercontent.com/tone-3000/neural-amp-modeler-wasm/refs/heads/main/ui/public/screenshot.png)

## Architecture

The wasm engine (v2) is a small single-threaded module with a plain C API
(`wasm/nam-engine.cpp`) that supports multiple independent NAM instances. It is
instantiated exactly once inside a hand-written AudioWorklet processor
(`ui/src/engine/nam-worklet.ts`); the main-thread API (`ui/src/engine/NamEngine.ts`)
passes the wasm bytes into the worklet, so nothing is fetched from worklet scope.

This deliberately avoids Emscripten's `-sAUDIO_WORKLET`/pthreads/SharedArrayBuffer
machinery — instantiating a threaded module a second time on the audio thread
caused a wasm recompile storm in WebKit that crossed the iOS Jetsam memory limit
at play time. The single-module architecture is inspired by
[openDAW](https://github.com/andremichelle/openDAW)'s NAM integration.

Consequences:

- No COOP/COEP headers or cross-origin isolation needed (no SharedArrayBuffer).
- 64 MB initial wasm heap (grows on demand to 512 MB max) instead of 1 GB.
- All engine assets ship inside the npm package; nothing to host separately.
- Model load errors are reported cleanly (wasm exceptions) instead of aborting.

Repo layout:

- `NAM/` — vendored NeuralAmpModelerCore DSP (v0.5.4, A2 + slimmable models)
- `wasm/` — the C API and Emscripten build for the engine
- `ui/` — the npm package: engine JS layer + React players + demo app
- `tools/` — native tools, Node smoke tests, browser e2e + memory tests

## Building

Initialize submodules first (Eigen, AudioDSPTools):

```bash
git submodule update --init --recursive
```

### WASM engine build

Requires Node.js and [Emscripten](https://emscripten.org) (tested with 6.0.x):

```bash
# One-time emsdk setup
git clone https://github.com/emscripten-core/emsdk.git ~/emsdk
cd ~/emsdk && ./emsdk install latest && ./emsdk activate latest

# Build (from the repo root)
source ~/emsdk/emsdk_env.sh
./wasm/build.bash
```

This produces `ui/src/engine/wasm/nam-engine.{js,wasm}` (the ES-module glue and
the wasm binary), which the UI package bundles into `dist/engine/` at build time.

### UI package and demo app

```bash
cd ui
npm install
npm start        # builds the package, then serves the demo app on :3000
npm run build    # production build of the npm package into dist/
```

## Testing

- **Node smoke test** (no browser; exercises the C API through the glue):

  ```bash
  cd ui && npm run test:smoke
  ```

  Covers instance lifecycle, A1/A2 model loads, slimmable sizing, audio
  processing sanity, error handling, and heap stability across model switches.

- **Browser e2e** (Playwright, WebKit + Chromium; drives the real React players
  in the demo app):

  ```bash
  cd ui && npm start          # in one terminal (any port; pass --url below)
  cd tools/e2e && npm install
  npx playwright install webkit chromium
  node preview-e2e.mjs --url http://127.0.0.1:3000
  ```

  Verifies engine init without cross-origin isolation, audible playback,
  and mid-playback model switching, with no console errors.

- **Memory harness** (`tools/memtest-browser/`): drives the engine under
  continuous playback and repeated A1/A2 model switches while sampling per-process
  RSS and `phys_footprint` (the metric iOS Jetsam kills on). Used to validate the
  v2 architecture: ~50–75 MB footprint vs ~450–570 MB peaks in v1.

- **Native tools** (`tools/`): `run_tests`, `loadmodel`, `benchmodel` from
  upstream, built via CMake.

## Using the React component

See the [package README](./ui/README.md) for full documentation of the
`T3kPlayer` React components and the standalone
`neural-amp-modeler-wasm/engine` API.

```tsx
import { T3kPlayer, T3kPlayerProvider } from 'neural-amp-modeler-wasm';
import 'neural-amp-modeler-wasm/dist/styles.css';

function App() {
  return (
    <T3kPlayerProvider>
      <T3kPlayer
        models={[{ name: 'Vox AC10', url: '/models/ac10.nam', default: true }]}
        irs={[{ name: 'Celestion', url: '/irs/celestion.wav', default: true }]}
        inputs={[{ name: 'Guitar', url: '/inputs/guitar.wav', default: true }]}
      />
    </T3kPlayerProvider>
  );
}
```

## Credits

- [Steve Atkinson's NeuralAmpModelerCore](https://github.com/sdatkinson/NeuralAmpModelerCore) — the DSP library this fork builds on.
- [openDAW](https://github.com/andremichelle/openDAW) by André Michelle — the
  single-module AudioWorklet architecture the v2 engine is based on.
- [Kutalia's NeuralAmpModelerCore_WASM](https://github.com/Kutalia/NeuralAmpModelerCore_WASM) — prior art for JSON-string model loading in wasm builds.
