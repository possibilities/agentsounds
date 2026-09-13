> *Slop Made With Sweat: Made with a lot of love by someone who loves code but read none of it.*

# agentsounds

Procedural UI sounds for the terminal — a library, a CLI, and a TUI. Every sound is
synthesized from a recipe; there are no audio files in here.

**▶ [Watch the demo](https://youtu.be/K1wfPpOcnfU)** — 27 seconds of the TUI, with sound.

## Install

```bash
scripts/install.sh --install
```

Bun 1.3.14+, and an audio player (`afplay`, `paplay`, `aplay`, or `ffplay`).

The installer runs a frozen dependency install, links `~/.local/bin/agentsounds`
to its clean checkout, and records the deployed Git SHA. `--check` prints the
plan; `--uninstall` removes the owned command and receipt. Kept recipes, cached
WAVs, and pre-existing Bun links remain untouched. AgentStart invokes this
installer as part of fleet convergence.

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

Agents read `agentsounds guide --json` — the fleet agent contract, with every command, its
arguments, and the error codes. `--agent-help` is the same document as text.

Agents can discover `agentsounds` through the directly connected MCP server and call its contract-derived
`notify` and `guide` MCP tools. `agentsounds mcp` serves stdio in process; the
operator TUI remains outside the producer surface. Arguments retain their names
without leading dashes. `notify` plays unless `no-play:true`; `print:true`
returns the leveled recipe in `data.patch`. MCP paths must be absolute and stdin
is reserved for JSON-RPC. Cancellation or disconnect stops and reaps pending
playback. The CLI envelope is preserved in structured content and standalone
JSON text, including domain errors and their recovery.

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
