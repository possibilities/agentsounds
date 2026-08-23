# Glossary

- **Patch** — The recipe for one sound: layers, each with a source (oscillator or noise), an envelope, a gain, an optional filter, and optional effects. Plain JSON, and the only sound format in the system. _Avoid_: sample, audio file.
- **Layer** — One voice inside a Patch. _Avoid_: voice.
- **Source** — One of the eight things a draw can be asked for: the seven categories, plus `experimental`. These are the product page's eight buttons. _Avoid_: category when `experimental` is in scope, since it is not one.
- **Category** — One of the seven intention-based categories: tap, hover, transition, success, error, warning, notification. _Avoid_: type, kind, vibe words.
- **Modality** — Which engine a draw uses: `familiar` (the curated library, varied within strict bounds) or `exotic` (the remix engine, rebuilding a library sound by learned taste). Upstream calls these rungs `core` and `orbit`. _Avoid_: version, level, intensity — they are peers, not tiers.
- **Sound** — A drawn Patch with everything the surfaces need: its derived name, its source, its leveled volume, its duration, and its lead frequency. _Avoid_: track, clip.
- **Derived name** — `<source>-<patchTag>`, where the tag is an FNV-1a hash of the canonical recipe. The same recipe always names alike, which is what makes an exported `success-8c1e3.wav` findable and what makes a repeat audible as a repeat. _Avoid_: id, random suffix.
- **Kept recipe** — A Patch written to a file with its leveled volume baked in, to be replayed later with `--sound`. This is how a sound becomes stable: a draw is always fresh, so anything that must sound the same twice is kept. _Avoid_: preset, saved sound, pinned sound.
- **Leveling** — The play-time volume solved against a loudness target, per drawn category. Never written into a Patch; baked in only at render and at keep. _Avoid_: normalization, gain staging.
- **The vendored tree** — `src/sounds/`, copied byte-for-byte from procedural-sounds and never edited here. Byte-identity is what makes a headless render provably the same node graph a browser builds. Its commit is in `src/sounds/UPSTREAM`; `bun run sync` re-vendors. _Avoid_: fork, port.
- **The audio host** — `src/audio-host.ts`, which assigns Web Audio globals from node-web-audio-api. This is the entire port: the vendored player addresses Web Audio by global name, so supplying those names is all that stands between the browser and a terminal. _Avoid_: shim, adapter, wrapper.
- **Envelope** — The `{schema_version, ok, error, data}` wrapper every `--json` outcome is emitted in, shared across the agent\* family. A usage fault is not an Envelope: it prints help to stderr and exits 2. _Avoid_: payload, response.
- **The stage** — The TUI's press-to-hear control for the current sound, mirroring the product page's in-context trigger. It is a button and nothing more. _Avoid_: player, visualizer.
