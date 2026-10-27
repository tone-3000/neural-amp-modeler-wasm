# Neural Amp Modeler WebAssembly React Player

This is a [TONE3000](https://tone3000.com) WebAssembly port of [Steve Atkinson's Neural Amp Modeler Core](https://github.com/sdatkinson/NeuralAmpModelerCore) DSP library (built against `v0.5.4`, unmodified), running Neural Amp Modeler inference in web browsers. This enables real-time audio amp modeling directly in the browser without native plugins.

The engine is a lightweight single-threaded wasm module instantiated inside an AudioWorklet — an architecture inspired by [openDAW](https://github.com/andremichelle/openDAW)'s NAM integration. There is no SharedArrayBuffer, no COOP/COEP header requirement, and no separate wasm files to host: everything ships inside this package.

Version 3 ships one `T3kPlayer` component for every surface — a mini play button, a compact bar that docks under a card, or the full player with a tone header — for one tone or a playlist, with a single `onEvent` stream and an embed bridge for iframes. See the [CHANGELOG](./CHANGELOG.md) for the v2 → v3 migration table.

![screenshot](https://raw.githubusercontent.com/tone-3000/neural-amp-modeler-wasm/refs/heads/main/ui/public/screenshot.png)

## Installation

```bash
npm install neural-amp-modeler-wasm
```

No additional file hosting or server headers are required. The engine assets (`nam-worklet.js`, `nam-engine.wasm`) are part of the package and are located automatically via `import.meta.url`, which every major bundler (Vite, webpack 5, Next.js, Rollup) resolves to hashed static assets.

## Usage

```tsx
import { NO_IR, T3kPlayer, T3kPlayerProvider } from 'neural-amp-modeler-wasm';
import 'neural-amp-modeler-wasm/styles.css';

const base =
  'https://raw.githubusercontent.com/tone-3000/neural-amp-modeler-wasm/refs/heads/main/ui/public';

function App() {
  return (
    <T3kPlayerProvider>
      <T3kPlayer
        layout='full'
        tones={[
          {
            id: 'ac10',
            meta: {
              title: 'Vox AC10',
              subtitle: 'Amp Capture',
              format: 'nam',
              imageUrl: `${base}/screenshot.png`,
              href: 'https://www.tone3000.com',
              author: { name: 'tone3000', verified: true },
            },
            assets: {
              models: [{ name: 'Vox AC10', url: `${base}/models/ac10.nam` }],
              irs: [
                NO_IR,
                {
                  name: 'Celestion',
                  url: `${base}/irs/celestion.wav`,
                  default: true,
                },
                {
                  name: 'EMT 140 Plate',
                  url: `${base}/irs/plate.wav`,
                  mix: 0.5,
                },
              ],
              inputs: [
                {
                  name: 'Mayer - Guitar',
                  url: `${base}/inputs/Mayer%20-%20Guitar.wav`,
                  default: true,
                },
                {
                  name: 'Downtown - Bass',
                  url: `${base}/inputs/Downtown%20-%20Bass.wav`,
                },
              ],
            },
          },
        ]}
        onEvent={event => {
          if (event.type === 'play') console.log(event.toneId, event.selection);
        }}
      />
    </T3kPlayerProvider>
  );
}
```

`T3kPlayerProvider` owns the AudioContext and the wasm engine, shared by every player beneath it. Nothing is created or downloaded until the first user gesture: no AudioContext, no wasm fetch, no model, IR or DI request. Only one player plays at a time; starting one pauses the other — including players in other same-origin iframes on the page, which coordinate over a `BroadcastChannel`.

If your bundler cannot resolve `new URL(..., import.meta.url)` assets, copy `dist/engine/nam-worklet.js` and `dist/engine/nam-engine.wasm` to your static directory and point the provider at them:

```tsx
<T3kPlayerProvider engineAssets={{ assetBaseUrl: '/engine/' }}>
```

## Tones

A `PlayerTone` is the unit the player renders: an id, optional display metadata, and the audio assets.

```ts
interface PlayerTone {
  id: string; // unique within one player
  meta?: {
    title: string;
    imageUrl?: string;
    imageFallback?: ReactNode; // fills the image square when there's no imageUrl
    href?: string; // title / image link
    subtitle?: string; // muted text under the title: 'Amp Head Capture'
    format?: string; // TONE3000 format pill: 'nam' | 'ir'
    author?: {
      name: string;
      avatarUrl?: string; // falls back to the TONE3000 silhouette
      href?: string;
      verified?: boolean; // TONE3000 verified check
    };
  };
  assets: PlayerAssets | (() => Promise<PlayerAssets>);
}

interface PlayerAssets {
  models: Model[]; // { name, url: string | null, default? }  — NAM A2 (.nam SlimmableContainer) only; url null = pass-through
  irs: IR[]; // { name, url: string | null, default?, mix? }  — url null means "no cabinet"
  inputs: Input[]; // { name, url, default? }
  preModels?: Model[]; // a second NAM ahead of `models` (an amp driving a cab capture); replaces the IR select
  previewMode?: 'model' | 'ir'; // which select is primary; default 'model'
  labels?: { model?: string; ir?: string; preModel?: string; input?: string }; // select captions
}
```

**The chain is fixed: `preModels → models → irs`.** A tone owns one slot (`models`, or `irs` when `previewMode` is `'ir'`) and the controls show exactly one companion select next to it: `preModels` when given, otherwise the other of `models` / `irs`. That is enough for every TONE3000 gear type — a cab IR after an amp capture, an amp before an IR pack, an amp ahead of a cabinet capture — without the player knowing about gear. `NO_MODEL` and `NO_IR` (exported) are the "None" options; an empty NAM slot passes audio through.

**Models are NAM A2 only.** The player loads `.nam` files in the `SlimmableContainer` format (one or more submodels at different sizes; `slimSize` picks one). A legacy single-architecture file is rejected with an `error` event (`code: 'model'` when selected while playing, `'audio'` when play starts on it). To migrate a legacy model, re-capture it on [TONE3000](https://www.tone3000.com), which trains A2.

**IRs carry no level.** Every IR is gain-staged automatically when it loads: the kernel is scaled to unity in-band response (mean power over 100 Hz – 5 kHz = 0 dB), the same convention as the TONE3000 pedal, so a cabinet leaves the model's loudness essentially unchanged and switching cabs doesn't jump in level. Models with a `loudness` in their metadata are normalized to −18 dB by the engine, clamped to ±12 dB, like the plugin.

**Mix follows the plugin.** `mix` is the IR's wet/dry balance. Leave it out and the engine applies the plugin's rule once the file is decoded: longer than 1 s → 50 % (a reverb), otherwise 100 % (a cab). Set it to pin the behaviour (`1` for a long cab IR, `0.5` for a short room). Whenever the active IR is reverb-like — an explicit `mix` below 1, or the length rule said so — a Mix knob appears beside its select; the user's setting is kept per tone and reset when the IR changes. The bundled lists are split into `DEFAULT_CAB_IRS` and `DEFAULT_REVERB_IRS` (`DEFAULT_IRS` is both).

Captions default to the TONE3000 vocabulary: the primary is "NAM Capture" or "Impulse Response (IR)", the companion "Cab" (IR), "Amp" (model or pre-model), and "Input". Override per tone with `labels`.

`assets` may be a function. The player calls it the first time the tone is activated, shows a loading state, and caches the result. Rejections surface as an `error` event and a message in the panel. This is how a list of tones can render instantly while each tone's models load on demand.

**One tone** renders the single-tone player. **Two or more** render a playlist: the header gains a ‹ n/N › pager, and the playbar and controls follow the active tone. The companion (IR, pre-model) and input choice carry over from tone to tone when the next tone offers the same URL.

### Bundled demo library

The package exports ready-made lists so a player works with no assets of your own: `DEFAULT_MODELS`, `DEFAULT_CAB_IRS`, `DEFAULT_REVERB_IRS` (`DEFAULT_IRS` is both) and `DEFAULT_INPUTS`. They point at the files under [`ui/public`](https://github.com/tone-3000/neural-amp-modeler-wasm/tree/main/ui/public) on GitHub, so nothing is added to your bundle and nothing is fetched until play.

```tsx
import {
  DEFAULT_CAB_IRS,
  DEFAULT_INPUTS,
  DEFAULT_MODELS,
} from 'neural-amp-modeler-wasm';

const tones = DEFAULT_MODELS.map(model => ({
  id: model.name,
  meta: { title: model.name, format: 'nam' },
  assets: {
    models: [model],
    irs: DEFAULT_CAB_IRS,
    inputs: DEFAULT_INPUTS,
  },
}));
```

| Models (NAM A2)                                                                                                                      | Cab IRs                                                                      | Reverb IRs                                         |
| ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- | -------------------------------------------------- |
| Fender Deluxe Reverb, Marshall JCM800, Vox AC10, Dumble Overdrive Special, Ampeg V-2, Boosted EVH 5153 (by @pippress), Roland JC-120 | Mesa 412 OS, Celestion G12 Vintage, Eminence Governor, Ampeg 8x10 (`mix: 1`) | EMT 140 Plate (`mix: 0.3`), Fender Spring (`0.35`) |

`DEFAULT_INPUTS` is 34 guitar and bass DI tracks (20–30 s, 48 kHz mono). Every bundled model is an A2 `SlimmableContainer` with `loudness` metadata. See [`public/models/README.md`](https://github.com/tone-3000/neural-amp-modeler-wasm/blob/main/ui/public/models/README.md) for how to contribute models, [IRs](https://github.com/tone-3000/neural-amp-modeler-wasm/blob/main/ui/public/irs/README.md) and [inputs](https://github.com/tone-3000/neural-amp-modeler-wasm/blob/main/ui/public/inputs/README.md).

## Layouts

| `layout`  | What renders                                                          | Playlist |
| --------- | --------------------------------------------------------------------- | -------- |
| `mini`    | A play/pause button. The tone title is the accessible label.          | no       |
| `compact` | Playbar; controls behind a toggle. Header only for playlists (pager). | yes      |
| `full`    | Tone header + playbar + controls, always expanded.                    | yes      |

Every panel is one stack: source tabs ("Sample" / "Plug in and play") with the attribution, tone header, playbar, then the body. The source tab is shared by every player under one `T3kPlayerProvider`: switching one player to live switches the page (and stops whatever was playing), so a connected interface works in every player without configuring each one. The body shows the controls, or — on the live tab — the connect flow (permission, device discovery, per-browser unblock steps) and the inline audio settings (interface, output, input channel with meters). There is no dialog.

`compact` with `docked` drops the top radius and border so it sits flush under a host card (the tone3000 search card pattern). `mini` with more than one tone falls back to `compact` with a console warning.

## Props

| Prop              | Type                             | Default    | Notes                                                                                                                                               |
| ----------------- | -------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tones`           | `NonEmptyArray<PlayerTone>`      | —          |                                                                                                                                                     |
| `layout`          | `'mini' \| 'compact' \| 'full'`  | `'full'`   |                                                                                                                                                     |
| `defaultToneId`   | `string`                         | first      | Playlist: active tone on mount.                                                                                                                     |
| `defaultExpanded` | `boolean`                        | `false`    | `compact`: start with controls open.                                                                                                                |
| `live`            | `boolean`                        | `true`     | Show the Sample / Plug in and play tabs. In an iframe this needs `allow="microphone"` on the host's tag — see [Embedding](#embedding-in-an-iframe). |
| `slimSize`        | `number`                         | —          | `[0, 1]` for slimmable (A2) models; omit for full size.                                                                                             |
| `disabled`        | `boolean \| { reason?: string }` | `false`    | Renders the disabled state; `reason` is shown in the panel.                                                                                         |
| `isLoading`       | `boolean`                        | `false`    | Skeleton state while the host fetches tones.                                                                                                        |
| `theme`           | `'dark' \| 'light'`              | `'dark'`   | Both are token sheets on the root.                                                                                                                  |
| `headerSlot`      | `ReactNode`                      | —          | Extra content on the playbar (e.g. an info icon).                                                                                                   |
| `attribution`     | `boolean`                        | `true`     | "Powered by TONE3000" footer.                                                                                                                       |
| `linkTarget`      | `'_blank' \| '_self'`            | `'_blank'` | For `meta.href` links. Keep `_blank` inside iframes.                                                                                                |
| `docked`          | `boolean`                        | `false`    | `compact`: flush under a card.                                                                                                                      |
| `size`            | `number`                         | `40`       | `mini`: button diameter in px.                                                                                                                      |
| `id`              | `string`                         | auto       | Stable id if you need to correlate events across remounts.                                                                                          |
| `onEvent`         | `(event: PlayerEvent) => void`   | —          | See below.                                                                                                                                          |

## Events

Everything the player does is reported through one `onEvent` callback. The same stream is what the embed bridge forwards to a host page.

```ts
type PlayerEvent =
  | { type: 'ready' }
  | {
      type: 'play';
      mode: 'demo' | 'live';
      toneId;
      selection: { model; ir; input };
      device?: string | null;
    }
  | { type: 'pause'; toneId }
  | { type: 'ended'; toneId }
  | { type: 'tone_change'; toneId }
  | {
      type: 'selection_change';
      toneId;
      field: 'model' | 'ir' | 'input' | 'preModel' | 'mix';
      value: Model | IR | Input | number;
    }
  | { type: 'bypass_change'; bypassed: boolean }
  | { type: 'source_change'; mode: 'demo' | 'live' }
  | { type: 'view_change'; view: 'controls' | 'settings' }
  | { type: 'expand' }
  | { type: 'collapse' }
  | { type: 'resize'; height: number }
  | {
      type: 'error';
      toneId?;
      code: 'assets' | 'model' | 'ir' | 'audio' | 'engine';
      message: string;
    };
```

Every `play` is followed by exactly one `pause` or `ended` for that tone — including when another player on the page takes over, or when the user switches tones inside a playlist.

## Embedding in an iframe

The player is iframe-safe by construction: no portals, no `position: fixed`, native `<select>`s, and `linkTarget='_blank'` by default. Two small pieces connect a frame to its host.

**Inside the frame**, hand the bridge's `onEvent` to the player:

```tsx
import { T3kPlayer, T3kPlayerProvider } from 'neural-amp-modeler-wasm';
import { useEmbedBridge } from 'neural-amp-modeler-wasm/embed';

function Frame({ tones }) {
  const bridge = useEmbedBridge();
  return (
    <T3kPlayer
      tones={tones}
      layout='full'
      // No host resizer → the frame can't grow, so don't start collapsed.
      defaultExpanded={bridge.hostHasResizer === false}
      onEvent={bridge.onEvent}
    />
  );
}
```

**On the host page**, mark the iframe and include the host script (serve `neural-amp-modeler-wasm/embed.js`, ~1.5 KB, from your own origin):

```html
<iframe
  data-t3k-player
  src="https://your-site/embed/player?tones=123"
  title="Player"
  allow="autoplay; microphone"
></iframe>
<script async src="https://your-site/embed.js"></script>
```

The host writes the `<iframe>` itself rather than having the script create it, so embeds work without JavaScript and inside CMS blocks that strip `<script>` tags. `allow="microphone"` is what lets the "Plug in and play" tab reach the user's audio interface from inside a cross-origin frame; a frame's permissions policy is fixed when it navigates, so the script can't add it afterwards. It warns in the console when a frame is missing it. If you don't want live mode in an embed, pass `live={false}` in the frame (the reference frame reads `?live=0`) and drop `microphone` from `allow`. When the policy does deny the microphone, the live tab says so and links to `meta.href` instead of showing browser unblock steps.

The script sizes every `iframe[data-t3k-player]` to the height the player reports (including frames injected later), tells the player a resizer is present so it can offer expand/collapse, and re-dispatches player events on the iframe element as bubbling `t3k:<type>` CustomEvents:

```js
document.addEventListener('t3k:play', e =>
  analytics.track('player_play', e.detail)
);
```

Messages are versioned (`v: 1`) and verified by `event.source` and the frame's origin on the host side. Types and guards are exported from `neural-amp-modeler-wasm/embed`.

## Theming

Colours, type and radii flow through CSS variables on the `.neural-amp-modeler` root. `theme='light'` switches to the second sheet; override any variable on a wrapper to restyle:

```css
.my-brand .neural-amp-modeler {
  --t3k-surface: #0b0b0f;
  --t3k-accent: #ffcc00;
  --t3k-on-accent: #000;
  --t3k-radius: 8px;
}
```

Tokens: `--t3k-canvas`, `--t3k-surface`, `--t3k-surface-2`, `--t3k-line`, `--t3k-line-strong`, `--t3k-fg`, `--t3k-muted`, `--t3k-muted-2`, `--t3k-accent`, `--t3k-on-accent`, `--t3k-link`, `--t3k-success`, `--t3k-danger`, `--t3k-warning`, `--t3k-toggle-on`, `--t3k-toggle-off`, `--t3k-toggle-knob` (the switch; same in both themes), `--t3k-font`, `--t3k-font-mono`, `--t3k-radius`, `--t3k-radius-sm`.

## Engine API (no React)

The underlying engine is exported for applications that build their own audio
graphs:

```ts
import { NamEngine } from 'neural-amp-modeler-wasm/engine';

const ctx = new AudioContext();
const engine = await NamEngine.attach(ctx); // registers worklet, fetches wasm

const node = await engine.createNode(); // an AudioWorkletNode subclass
source.connect(node).connect(ctx.destination);

const info = await node.loadModel(namFileJsonString, { slimSize: 0.5 });
console.log(info); // { hasLoudness, loudness, expectedSampleRate, slimmable, ... }

node.dispose(); // frees the wasm instance
```

- `NamEngine.attach(ctx, assets?)` — one engine per AudioContext; the wasm
  module is instantiated once inside the worklet scope.
- `engine.createNode()` — each node is an independent NAM instance (own model,
  own state) processed inside the shared module.
- `node.setSlimSize(size)` — re-slim a loaded slimmable model without
  reloading it (no-op for non-slimmable models).
- `node.unloadModel()` — drop the model; the node passes audio through
  unchanged until the next load.
- `NamNodePool` — LRU pool for UIs that render many players but play one at a
  time: `pool.acquire(key)` reuses a node already holding that player's model
  and evicts the least recently used node above `maxNodes`.

## Requirements

- A browser with AudioWorklet and wasm exception support (all evergreen
  browsers, Safari ≥ 15.2).
- No special server headers. (v1 required COOP/COEP for SharedArrayBuffer;
  v2 does not use SharedArrayBuffer.)

## Development

This package is part of the [neural-amp-modeler-wasm](https://github.com/tone-3000/neural-amp-modeler-wasm) project, which includes the wasm engine sources and build. See the [main repository](https://github.com/tone-3000/neural-amp-modeler-wasm) for the project structure and development setup.

## Credits

- [Steve Atkinson's NeuralAmpModelerCore](https://github.com/sdatkinson/NeuralAmpModelerCore) — the DSP library this port builds on.
- [openDAW](https://github.com/andremichelle/openDAW) by André Michelle — the
  single-module AudioWorklet architecture that v2's engine is based on.
- [Kutalia's NeuralAmpModelerCore_WASM](https://github.com/Kutalia/NeuralAmpModelerCore_WASM) — prior art for JSON-string model loading in wasm builds.

## License

MIT
