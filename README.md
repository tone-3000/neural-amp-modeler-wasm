# Neural Amp Modeler Wasm

[![npm version](https://img.shields.io/npm/v/neural-amp-modeler-wasm.svg)](https://www.npmjs.com/package/neural-amp-modeler-wasm)

This is a [TONE3000](https://tone3000.com) WebAssembly port of [Steve Atkinson's Neural Amp Modeler Core](https://github.com/sdatkinson/NeuralAmpModelerCore) DSP library, enabling real-time audio amp modeling directly in the browser without native plugins. The core library is consumed unmodified as a git submodule pinned to its latest release (`v0.5.4`); this repo contains only the wasm engine and the UI package.

The `neural-amp-modeler-wasm` npm package ships the engine, a React player (`T3kPlayer`: mini / compact / full layouts, playlists, sample playback and live input through an audio interface) and an iframe embed bridge, so a tone can be played on tone3000.com, inside a share embed, or on a partner's product page from one code path.

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

- `core/` — [NeuralAmpModelerCore](https://github.com/sdatkinson/NeuralAmpModelerCore) submodule, pinned to `v0.5.4` (A2 + slimmable models); brings its own Eigen/nlohmann/AudioDSPTools dependencies
- `wasm/` — the C API and Emscripten build for the engine
- `ui/` — the npm package: engine JS layer + React player + embed bridge + demo app
- `ui/public/` — bundled demo library: NAM A2 [models](./ui/public/models/README.md), [IRs](./ui/public/irs/README.md) and DI [inputs](./ui/public/inputs/README.md), served from GitHub by the published package's `DEFAULT_*` lists
- `tools/smoke/` — Node smoke test for the engine

## Building

Clone with submodules (`git clone --recursive`), or initialize them after the fact:

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

The dev server serves three pages: `/` (every layout and state of the player
side by side), `/frame.html` (the reference iframe page a site would host,
`?tones=0,3&layout=compact&live=0`) and `/embed.html` (a mock partner product
page that embeds several frames through `embed.js` and logs the `t3k:*` events
it receives).

## Testing

- **Node smoke test** (no browser; exercises the C API through the glue):

  ```bash
  cd ui && npm run test:smoke
  ```

  Covers instance lifecycle, A1/A2 model loads, slimmable sizing, audio
  processing sanity, error handling, and heap stability across model switches.

- **Typecheck and formatting:**

  ```bash
  cd ui && npm run typecheck && npm run format:check
  ```

Upstream's native tools, tests, and benchmarks live in the `core/` submodule;
build them there with core's own CMake project if needed.

## Publishing the npm package

```bash
cd ui
npm version <major|minor|patch>   # bumps ui/package.json, tags the commit
npm publish                       # prepublishOnly: format check, typecheck, smoke test
```

`npm publish` runs `prepare` (clean + build) before packing, so `dist/` is
always rebuilt from source. The tarball contains `dist/`, `README.md`,
`CHANGELOG.md` and `LICENSE` only; the demo library under `ui/public/` is not
published — the package's `DEFAULT_*` lists point at it on GitHub. Use
`npm pack --dry-run` to inspect the file list first.

## Bumping the core version

```bash
cd core
git fetch --tags
git checkout vX.Y.Z
cd ..
./wasm/build.bash && node tools/smoke/nam-engine-smoke.mjs
git add core && git commit -m "Bump NAM core to vX.Y.Z"
```

Also update the version string in `nam_getVersion()` (`wasm/nam-engine.cpp`),
which is hardcoded because the upstream `v0.5.4` tag ships `NAM/version.h` with
a stale patch number.

## Using the React component

See the [package README](./ui/README.md) for full documentation of the
`T3kPlayer` React component (tones, layouts, events, theming), the iframe
embed bridge, and the standalone `neural-amp-modeler-wasm/engine` API.

```tsx
import { NO_IR, T3kPlayer, T3kPlayerProvider } from "neural-amp-modeler-wasm";
import "neural-amp-modeler-wasm/styles.css";

function App() {
  return (
    <T3kPlayerProvider>
      <T3kPlayer
        layout="full"
        tones={[
          {
            id: "ac10",
            meta: { title: "Vox AC10", subtitle: "Amp Capture", format: "nam" },
            assets: {
              models: [{ name: "Vox AC10", url: "/models/ac10.nam" }],
              irs: [
                NO_IR,
                { name: "Celestion", url: "/irs/celestion.wav", default: true },
              ],
              inputs: [{ name: "Guitar", url: "/inputs/guitar.wav" }],
            },
          },
        ]}
        onEvent={(event) => console.log(event)}
      />
    </T3kPlayerProvider>
  );
}
```

### Embedding on another site

The same player runs inside a cross-origin `<iframe>`. The frame hands
`useEmbedBridge().onEvent` to the player; the host page marks its iframes with
`data-t3k-player` and includes the dependency-free `embed.js` host script
(`neural-amp-modeler-wasm/embed.js`), which sizes the frames and re-dispatches
player events as `t3k:*` CustomEvents. Live input works in an embed when the
host's iframe carries `allow="autoplay; microphone"`. See
[Embedding in an iframe](./ui/README.md#embedding-in-an-iframe).

## Credits

- [Steve Atkinson's NeuralAmpModelerCore](https://github.com/sdatkinson/NeuralAmpModelerCore) — the DSP library this port builds on.
- [openDAW](https://github.com/andremichelle/openDAW) by André Michelle — the
  single-module AudioWorklet architecture the v2 engine is based on.
- [Kutalia's NeuralAmpModelerCore_WASM](https://github.com/Kutalia/NeuralAmpModelerCore_WASM) — prior art for JSON-string model loading in wasm builds.
