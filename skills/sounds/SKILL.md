---
name: sounds
description: Generate and play procedural UI sounds from the terminal with the agentsounds CLI - taps, hovers, transitions, success, error, warning and notification sounds synthesized live from recipes, with no audio files anywhere. Use when a script, hook, or agent should make a sound ("play a sound when this finishes", "notify me audibly"), when picking a sound to use somewhere, or when a kept sound needs to be replayed the same way every time.
---

# Sounds

`agentsounds` synthesizes UI sounds from recipes. There are no audio files: every sound is
built from a `Patch` (layers, envelopes, filters, effects) and rendered on demand.

The model comes from its upstream product page and is worth holding: you pick a **source**,
pick a **modality**, and press. Every press is a **fresh draw** — you generate until one
fits. Nothing is a preset.

## Play a sound now

```bash
agentsounds notify success
agentsounds notify error --exotic
agentsounds notify --list          # the eight sources and what each is for
```

Sources: `tap`, `hover`, `transition`, `success`, `error`, `warning`, `notification`, and
`experimental` (category-agnostic, five engines at once). Modalities: `familiar` (default —
the curated library, varied within strict bounds) and `exotic` (`--exotic` — the remix engine
rebuilding a library sound by learned taste).

## Make a sound stable

This is the part that matters for hooks. A draw is always fresh, so a sound that must be
recognizable across a day of use is **kept as a recipe** and replayed:

```bash
agentsounds notify success --print > ~/.config/agentsounds/done.json
agentsounds notify --sound ~/.config/agentsounds/done.json
```

A kept recipe carries its leveled volume baked in, so it replays exactly as it sounded when
it was picked. Shop for one interactively with `agentsounds tui`.

Do not reach for a seed or a preset flag — there isn't one, deliberately. The recipe file is
the mechanism.

## Other flags

| Flag            | Effect                                        |
| --------------- | --------------------------------------------- |
| `--save <path>` | write a WAV instead of only playing           |
| `--reverse`     | play it backwards                             |
| `--no-play`     | do the work silently (pairs with save/print)  |
| `--json`        | `{schema_version, ok, error, data}` envelope  |

## Output contract

`--json` gives the house envelope on stdout: exit 0 with `ok:true`, exit 1 with `ok:false`
and a `recovery` line written to be run verbatim. A grammar mistake is different: help to
**stderr**, exit 2, never an envelope.

Error codes: `empty_pool` (no curated sounds for that source), `bad_recipe` (the `--sound`
file is not a recipe), `no_player` (no audio player installed), `playback_failed`.

## As a library

```ts
import { notify, draw, render, play } from "agentsounds";
await notify("success");
const sound = await draw("tap", { modality: "exotic" });
await Bun.write("tap.wav", await render(sound));
```

The CLI is a thin shell over these, so anything one can do the other can.

## Anti-patterns

| Don't                                          | Do                                                |
| ---------------------------------------------- | ------------------------------------------------- |
| Expect `notify success` to sound the same twice | keep the recipe and replay it with `--sound`       |
| Save a raw patch by hand from the library API   | `--print`, which bakes the level in                |
| Grep the human output                           | `--json`                                           |
| Ship a WAV to get a repeatable sound            | keep the recipe; it re-renders anywhere            |
