# agentsounds

Procedural UI sounds for the terminal. Every sound is synthesized from a recipe — there are
no audio files in here. Pick a source, press, and keep the ones you like.

The sound engine is [procedural-sounds](https://github.com/m1ckc3s/procedural-sounds),
vendored unmodified; this adds a headless renderer, a CLI, a library, and a TUI.

## Install

```bash
bun install
bun link            # puts `agentsounds` on PATH
```

Needs Bun 1.3.14+ and an audio player (`afplay` on macOS; `paplay`, `aplay`, or `ffplay`
elsewhere).

## Use

```bash
agentsounds notify success              # draw a success sound and play it
agentsounds notify tap --exotic         # the remix engine instead of the library
agentsounds notify experimental         # five engines at once, no category
agentsounds notify --list               # the eight sources and what each is for
agentsounds tui                         # browse and audition
```

Every press is a **fresh draw**, the way the product page works — you generate until one
fits. So to make a sound stable, keep its recipe:

```bash
agentsounds notify success --print > ~/.config/agentsounds/done.json
agentsounds notify --sound ~/.config/agentsounds/done.json
```

That second line is what belongs in a hook. A kept recipe carries its leveled volume baked
in, so it replays exactly as it sounded when you picked it.

Other flags: `--save <path>` writes a WAV, `--reverse` plays it backwards, `--no-play` does
the work without the sound, `--json` emits a machine-readable envelope.

## The eight sources

Seven intention-based categories, plus one that answers to none.

| Source         | For                                             |
| -------------- | ----------------------------------------------- |
| `tap`          | buttons, taps, toggles, switches, checkboxes    |
| `hover`        | pointer hover, focus highlights                 |
| `transition`   | open/close, page or panel movement, sending     |
| `success`      | completed tasks, saves, wins                    |
| `error`        | failures, invalid input, rejections             |
| `warning`      | caution prompts, risky actions                  |
| `notification` | incoming messages, alerts, dings                |
| `experimental` | five engines at once, category-agnostic         |

And two modalities: **familiar** draws from the curated library, varied within strict bounds;
**exotic** rebuilds a library sound into a new structure by learned taste.

## As a library

```ts
import { notify, draw, render, play } from "agentsounds";

await notify("success");                        // draw and play
await notify("tap", { modality: "exotic" });

const sound = await draw("error");              // { name, patch, volume, seconds, freq }
await Bun.write("error.wav", await render(sound));
await play(sound, { reverse: true });
```

The CLI is a thin shell over exactly these functions, which is what keeps the two surfaces
honest with each other.

## The TUI

`agentsounds tui` is the product page as an instrument: the eight sources on `1`-`8`, `f` to
flip modality, `space` to press the stage and hear the current sound again, `j`/`k` through
Recent Sounds, `s` to save a WAV, `c` to keep the recipe, `q` to quit.

It follows the [fx style guide](https://github.com/possibilities/fxnk): monochrome, one
grayscale ramp, state carried by glyph and weight rather than hue. Set `FX_THEME=light` or
`dark` to override the terminal-derived default.

## Licensing

MIT. The vendored engine and the eight projects that seeded its library are credited in
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
