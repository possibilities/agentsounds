# agentsounds

Procedural UI sounds for the terminal — a library, a CLI, and a TUI. Every sound is
synthesized from a recipe; there are no audio files in here.

![The agentsounds TUI](https://raw.githubusercontent.com/possibilities/agentsounds/main/media/tui-demo.gif)

_The GIF is silent, which rather misses the point — [here is the same 27 seconds with sound](https://github.com/possibilities/agentsounds/raw/main/media/tui-demo.mp4)._

## Install

```bash
bun install && bun link
```

Bun 1.3.14+, and an audio player (`afplay`, `paplay`, `aplay`, or `ffplay`).

## Use

```bash
agentsounds notify success      # draw a success sound and play it
agentsounds notify tap --exotic # the remix engine instead of the library
agentsounds tui                 # browse and audition
```

Eight sources: `tap`, `hover`, `transition`, `success`, `error`, `warning`, `notification`,
and `experimental`. Two modalities: `familiar` draws from the curated library, `exotic`
rebuilds a library sound into a new structure.

Every press is a fresh draw, so keep the ones you like:

```bash
agentsounds notify success --print > done.json
agentsounds notify --sound done.json     # this is what belongs in a hook
```

Also: `--save <path>` writes a WAV, `--reverse` plays it backwards, `--no-play` skips the
sound, `--json` emits a machine-readable envelope, `--help` has the rest.

```ts
import { notify, draw, render, play } from "agentsounds";
```

## Credit

The sound engine is **[procedural-sounds](https://github.com/m1ckc3s/procedural-sounds)** by
[Mick Cesanek](https://github.com/m1ckc3s), vendored here unmodified. That project is the
whole reason this exists — every sound you hear is its synthesis; this repo only adds a
headless renderer and three terminal surfaces on top. Go star it.

The eight projects that seeded its reference library are credited in
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

## License

MIT.
