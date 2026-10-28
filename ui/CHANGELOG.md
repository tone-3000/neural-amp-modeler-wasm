# Changelog

## 3.0.3

### Fixed

- The live LED's ring follows the input level again. 3.0.0 put a CSS
  transition on it, so the per-frame updates kept chasing targets they never
  reached: it lagged, snapped, and could stick on a stale level. The ring is
  now written straight to the SVG node each frame, which also stops the
  button re-rendering 60×/s while monitoring.

## 3.0.2

### Changed

- Primary buttons are TONE3000 blue. New tokens `--t3k-primary` (a gradient
  by default; any `background` value works) and `--t3k-on-primary`;
  `--t3k-accent` now only colours the transport glyphs.
- Full-width buttons no longer stretch across a wide panel: Done is capped
  and centred, and the Microphone Access step (steps, button, privacy note)
  is one left-aligned column.
- Live controls: the input group shares the capture select's column with
  the settings gear beside it, in line with the Tone toggle.
- Source tabs are a little shorter.

### Fixed

- Knob value tips no longer flash when the live controls mount or a mix
  resets; they show on hover, while dragging, and briefly after a wheel or
  keyboard turn.

## 3.0.1

### Fixed

- The Sample / Plug in and play tab is page-wide again, as in v2. 3.0.0 made
  it per player, so a page with several players had to be switched to live
  one at a time. Now every player under one `T3kPlayerProvider` follows the
  switch (and emits `source_change`), whatever was playing stops, and only
  the player that made the switch auto-connects the interface and starts
  monitoring; once connected, the shared interface is live in all of them.
- The bundled `jcm.nam` is a new, higher-gain Marshall JCM800 capture, and
  its label reads "Marshall JCM800".

## 3.0.0

One player component for every surface. v2 shipped three components
(`T3kPlayer`, `T3kSlimPlayer`, `T3kAcordianPlayer`, plus `T3kDisabledPlayer`)
with three prop contracts and five callbacks. v3 ships one `T3kPlayer` that
takes a list of **tones**, a **layout**, and a single **event stream**, and
adds an embed bridge so the same player can run inside a cross-origin iframe
and report its height to the host page. The engine is unchanged.

This is a clean break: there are no compatibility shims. The migration table
below covers every removed symbol.

### Breaking changes

| v2                                                                 | v3                                                                                        |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `<T3kPlayer models irs inputs …>`                                  | `<T3kPlayer tones={[{ id, meta?, assets: { models, irs, inputs } }]} layout='full'>`      |
| `<T3kAcordianPlayer …>`                                            | `<T3kPlayer … layout='compact'>` (`docked` to sit under a card)                           |
| `<T3kSlimPlayer …>`                                                | `<T3kPlayer … layout='mini'>`                                                             |
| `<T3kDisabledPlayer reason>`                                       | `<T3kPlayer … disabled={{ reason }}>`                                                     |
| `infoSlot`                                                         | `tones[i].meta` renders the header; `headerSlot` for extra playbar content                |
| `previewMode={PREVIEW_MODE.MODEL \| PREVIEW_MODE.IR}`              | `assets.previewMode: 'model' \| 'ir'` (per tone)                                          |
| `onPlayDemo({ model, ir, input })`                                 | `onEvent({ type: 'play', mode: 'demo', toneId, selection })`                              |
| `onPlayLive({ model, ir, device })`                                | `onEvent({ type: 'play', mode: 'live', toneId, selection, device })`                      |
| `onModelChange(model)` / `onIrChange(ir)` / `onInputChange(input)` | `onEvent({ type: 'selection_change', toneId, field: 'model' \| 'ir' \| 'input', value })` |
| `isLoading`                                                        | `isLoading` (unchanged)                                                                   |
| `slimSize`                                                         | `slimSize` (unchanged)                                                                    |
| `PREVIEW_MODE` enum                                                | `PreviewMode` string union                                                                |
| Custom `Select` component                                          | Native `<select>` (`NativeSelect`) — renders inside iframes and on every platform         |

New in `T3kPlayerProps`: `tones`, `layout`, `defaultExpanded`,
`defaultToneId`, `live`, `disabled`, `theme`, `headerSlot`, `attribution`,
`linkTarget`, `docked`, `size`, `id`, `onEvent`.

Also breaking, from the second pass over v3:

- **NAM A2 only.** `AudioGraph.loadModel` rejects anything that is not a
  `SlimmableContainer` (surfaces as an `error` event on play). The bundled demo
  models are all A2.
- **`IR.url` is `string | null`** (`null` = no cabinet; `NO_IR` is exported).
  `IR.gainDb` is gone: IRs are gain-staged automatically to unity in-band
  response on load (TONE3000 pedal convention), `ConvolverNode.normalize` is
  off. `mix` stays but is now optional: omitted, the engine applies the
  plugin's length rule (over 1 s → 0.5, else 1).
- **`Model.url` is `string | null`** (`null` = pass-through; `NO_MODEL` is
  exported) so an amp companion can offer "None".
- **`AudioGraph` has two NAM slots.** `loadModel(url, slimSize, slot)` takes
  `url: string | null` and `slot: 'main' | 'pre'`; `irUrl` became a getter
  over `graph.ir` (`url`, `mix`, `reverbLike`); `setIrMix(mix)` was added.
  `EngineSettings` gained `preModelUrl` and `mix`.
- **`ToneMeta.badge` → `format`; `chips` dropped; `imageFallback` added.** The
  header renders like a TONE3000 tone card: `subtitle` as muted text, `format`
  as the NAM / IR pill, the author's avatar (TONE3000 silhouette fallback) and
  the TONE3000 verified check. `imageFallback` fills the image square when
  there's no `imageUrl`.
- **No settings dialog.** The live setup wizard — Play Live → Microphone
  Access → Settings (interface, input channel meters, output device, Hear
  Yourself, Done) — renders inline under the playbar so it works in an
  iframe; `SettingsDialog`, `Dialog`, `InlineAlert`, `Select` are removed.
  The playbar's LED · LIVE | speaker button mutes/unmutes. The context no
  longer exposes `getAudioNodes()`; use `getGraph()` (an `AudioGraph`).
- **Playlists are a pager**, not a tone list: ‹ n/N › in the header steps the
  active tone. `tones[i].meta` renders a dense header in `compact`.

### Added

- **Any input channel.** The live input asks the browser for every channel
  the interface has and offers a radio + meter for each one it delivers, so a
  guitar on input 3 of an 8-in interface is selectable. `ChannelSelection` is
  now a 0-based `number` (was `'first' | 'second'`) and
  `LiveInputConfig.gainsDb` is a `number[]`. Browsers decide how many
  channels they hand over: Firefox gives the device's channels, Chrome and
  Safari usually stop at 2.
- **Playlists.** Two or more tones share one playbar and controls and page
  through the header. Assets may be given eagerly or as
  `() => Promise<PlayerAssets>` and are resolved on first use (deduped). IR
  and input choices carry over to the next tone when it offers the same URL.
- **`onEvent` stream.** `ready`, `play`, `pause`, `ended`, `tone_change`,
  `selection_change`, `bypass_change`, `source_change`, `view_change`,
  `expand`, `collapse`, `resize`, `error`. Exactly one `pause`/`ended` is
  emitted for every `play`, including when another player on the page takes
  over the engine.
- **Lazy engine.** Nothing is created or fetched (AudioContext, wasm, models,
  IRs, DI tracks) until the first user gesture. Model JSON and decoded IRs
  are cached per document / per context.
- **Fixed-topology audio graph** (`AudioGraph`, exported). Bypass is a
  crossfade, IR changes swap the convolver buffer, mix is a wet/dry pair; no
  runtime rewiring, so switching never clicks.
- **Multiple embeds on one page.** Players under one provider share the
  engine; players in separate same-origin iframes coordinate single playback
  over `BroadcastChannel('t3k-player:playback')`. Source tab is per player.
- **Loudness normalization clamp.** Loudness-aware models normalize to −18 dB
  clamped to ±12 dB; implausible `loudness` values (≤ −100 or > 0) run at
  unity, matching the plugin and pedal.
- **`assets.labels`** to recaption the selects; defaults follow the TONE3000
  vocabulary ("NAM Capture", "Cab", "Amp", "Input").
- **`assets.preModels`.** A second NAM ahead of the tone's model, for cabinet
  captures that want an amp in front. The controls show one companion select
  beside the tone: `preModels` if given, otherwise the other of `models` /
  `irs` — enough for TONE3000's gear matrix without the player knowing gear.
  `Selection.preModel`, `selection_change` with `field: 'preModel'`, and
  `labels.preModel` (default "Amp") come with it.
- **Mix knob.** Shown beside the IR select whenever the active IR is
  reverb-like (explicit `mix` below 1, or longer than 1 s with no explicit
  mix). The value is per tone (`Selection.mix`, `selection_change` with
  `field: 'mix'`) and resets when the IR changes. `DEFAULT_CAB_IRS` and
  `DEFAULT_REVERB_IRS` split the bundled list; `DEFAULT_IRS` is both.
- **Embed bridge.** `useEmbedBridge()` (from `neural-amp-modeler-wasm/embed`)
  forwards events and height to a host page over `postMessage`;
  `neural-amp-modeler-wasm/embed.js` is a dependency-free host script that
  sizes every `iframe[data-t3k-player]` and re-dispatches events as
  `t3k:<type>` CustomEvents. Protocol v1, see `src/embed/protocol.ts`.
  Live mode works inside embeds when the host's iframe carries
  `allow="autoplay; microphone"`; the host script warns when it's missing,
  and the live tab explains the denied policy (with a link to `meta.href`)
  instead of showing browser unblock steps.
- **Design tokens.** Colours, type and radii flow through `--t3k-*` CSS
  variables on the `.neural-amp-modeler` root; `theme='light'` is a second
  token sheet. New tokens: `--t3k-link`, `--t3k-danger`, `--t3k-warning`,
  `--t3k-font`, `--t3k-font-mono`, `--t3k-radius-sm`.

### Fixed

- Unmounting a player no longer stops playback owned by another player.
- Switching to live input in one player no longer flips every player on the
  page to live (and no longer lets a different player start monitoring).
- Reconnecting a live input no longer reports itself as a disconnected
  device: tearing down a stream detaches its `ended` listener first.
- Height reporting no longer depends on `requestAnimationFrame`, which
  browsers pause in offscreen iframes.

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
