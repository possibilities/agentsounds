# Recipes and playback

Sources are `tap`, `hover`, `transition`, `success`, `error`, `warning`,
`notification`, and `experimental`. Experimental draws from five engines and
does not belong to a category. `familiar` varies the curated library within
strict bounds; `exotic` rebuilds a library sound using the remix engine.

A draw is always fresh. A kept recipe is the JSON Patch returned in `data.patch`
when MCP `notify` receives `print:true`, with leveled volume baked into it.
Persist only that Patch object. A raw library Patch can have the wrong level.
The Derived name hashes a recipe; it is not a seed or a mutable preset id.

For a stable operator hook, the CLI can keep and replay the same recipe:

```bash
agentsounds notify success --print > /absolute/path/done.json
agentsounds notify --sound /absolute/path/done.json
```

Without `--json`, `--print` writes only the recipe to stdout. With `--json`, it
adds the recipe at `data.patch` inside the standard envelope. Terminal callers
can pipe a recipe to `--sound -`; MCP reserves stdin for JSON-RPC and requires
absolute paths. `--save` exports a WAV, `--reverse` reverses it, and `--no-play`
skips playback. Agent MCP arguments have the same names without `--`.

Keep recipes for repeatability across machines. Noise layers draw fresh grains
when rendered, so the same recipe is the same sound rather than byte-identical
WAV samples. The player may reuse its cached render for an identical recipe.

The library still exports `draw`, `render`, `play`, and `notify`. Library and
CLI consumers share the sound engine; MCP calls the CLI's typed handlers in
process. The human can audition with `agentsounds tui`; the MCP surface does
not launch that interactive application.

Playback needs an available system player and output device. `bad_recipe`
means the supplied file is missing, unreadable, or invalid. `no_player` means
none of afplay, paplay, aplay, or ffplay was found. `playback_failed` means the
chosen player exited nonzero. Use the returned recovery and inspect the exact
file or audio device. `empty_pool` means the selected source has no curated
sounds; `notify` with `list:true` shows the available sources.
