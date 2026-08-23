# agentsounds — repository guidance

Procedural UI sounds for the terminal. A library, a CLI, and a TUI over a generate-first
sound engine vendored from procedural-sounds. Read `README.md` for usage and `CONTEXT.md`
for the glossary — use its canonical terms in code, comments, and commit messages.

## Commands

`package.json` has the scripts; `bun run check` is the gate for every commit. The other check
that matters is listening: `bun src/cli.ts notify success` has to actually sound like
something, and no test can tell you that.

## Map

`src/` is flat, one module per concern, plus two subtrees.

- `draw.ts` is the model: `SOURCES`, `MODALITIES`, and `draw()`, a faithful port of the
  product page's press handler. The tournament in `pickBest` is upstream's, including its
  deliberate choice to sample rather than take the winner.
- `render.ts` and `play.ts` are the two things a browser gave us for free. Render is offline
  and always available, so leveling has no fallback path here — the site skips its measure on
  iOS, and this does not.
- `cache.ts` keys rendered WAVs by the Derived name, which is a hash of the recipe. A cache
  hit is therefore always the right file; a miss just renders.
- `descriptor.ts` is the single source for commands and flags. Help, `--help-json`, and
  validation all fall out of it — never hand-write a usage string.
- `tui/model.ts` is pure: state, key mapping, history. `tui/app.ts` renders it. The split is
  what makes the interaction contract testable without a renderer.
- `sounds/` is **vendored and never edited here**. See below.

## The vendored tree

`src/sounds/audio/` is procedural-sounds' `lib/audio/`, byte-for-byte. That is load-bearing,
not tidiness: `renderPatch` takes a `BaseAudioContext` and the player addresses Web Audio by
global name, so `audio-host.ts` supplying those globals is the entire port. Byte-identity is
what lets us claim a headless render is the same node graph a browser builds.

Consequences:

- Do not edit anything under `src/sounds/`. Fix it upstream, then `bun run sync`.
- The one import alias upstream uses (`limits.ts` reaching for `@/data/pool/limits.json`) is
  mapped in `tsconfig.json` rather than rewritten, for the same reason.
- `tsconfig.json` matches upstream's compiler flags. `exactOptionalPropertyTypes` and
  `noUncheckedIndexedAccess` are off because the vendored code predates them and a
  per-directory strictness split is not something tsc offers.
- `biome.json` excludes the tree from lint and format.

## Load-bearing decisions

In `docs/adr/`, one per file: vendoring verbatim over porting, the Web Audio host over a
hand-rolled renderer, and keeping a sound stable by keeping its recipe rather than seeding a
draw. Read them before changing how sounds are produced or replayed; append a new numbered
record rather than editing an old one.

## Two rules inherited from upstream

These are not stylistic and they are easy to break from here.

- **A draw is always fresh.** There is no seed and no preset. Anything that must sound the
  same twice is a Kept recipe, which is what `--print` and `--sound` are for. Adding a seed
  parameter would create a second identity for a sound alongside its Derived name.
- **A kept recipe carries its level baked in.** Printing a raw Patch would replay it at the
  wrong volume forever, since leveling is solved at play time and never stored in a Patch.

## The skill

`skills/sounds/SKILL.md` is the runbook most agent sessions see. Changing the command surface
means re-verifying its claims against the live CLI before editing its prose.
