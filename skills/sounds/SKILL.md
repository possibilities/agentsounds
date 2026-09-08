---
name: sounds
description: Generate and play procedural UI sounds from the terminal with the agentsounds CLI - taps, hovers, transitions, success, error, warning and notification sounds synthesized live from recipes, with no audio files anywhere. Use when a script, hook, or agent should make a sound ("play a sound when this finishes", "notify me audibly"), when picking a sound to use somewhere, or when a kept sound needs to be replayed the same way every time.
---

# Sounds

Use Sounds for requested audible feedback or a procedural UI sound. A sound is
synthesized from a recipe; rendered WAVs can be cached or explicitly exported.
Each new draw is fresh. For a recognizable repeated cue, keep the recipe once
and replay it.

## Discover and call

Use the `agentsounds` MCP server directly. Select the tool from the harness's
catalog or tool search, inspect its input schema, and call it with JSON
arguments. The host may prefix tool names with the server name. `guide`
provides the installed command contract and recovery guidance.
The producer tools are `notify` and `guide`; the human audition TUI is separate.

`notify` plays through the system audio device by default. Use `no-play:true`
when preparing a recipe or export silently. The following arguments make one
fresh success sound and return its leveled recipe:

```json
{"source":"success","print":true}
```

Choose exactly one of `source`, an absolute kept-recipe `sound` path, or
`list:true`. List the eight sources when their intended uses are unclear.
Choose the `familiar` modality by default; `exotic:true` remixes a sound when
variation is wanted. `exotic` and `modality` conflict, and neither belongs with
`sound`, which replays an existing recipe.

## Keep and replay

With `print:true`, the envelope's `data.patch` contains the kept recipe,
with its leveled volume baked in. Save that object as JSON using native file
tools, then call `notify` with its absolute `sound` path. Do not save the whole
envelope as a recipe. There is no seed or preset parameter.

`save` writes and may overwrite an absolute WAV destination; `reverse:true`
reverses playback or export. Cancelling a call or closing the MCP connection
stops its playback. Recipes and explicitly saved WAVs remain available.
For source/modality choices, recipe formats, and operator hooks, read
[recipes and playback](references/recipes.md).

## Results and recovery

Inspect MCP `isError` and AgentSounds's `{schema_version, ok, error, data}`
envelope in `structuredContent`. If the host returns only content blocks,
parse the standalone JSON block and keep diagnostic prose separate. Read
`error.code` and `recovery` before retrying or claiming success.
Diagnostic prose is a separate block. Read the original code and recovery:
`empty_pool`, `bad_recipe`, `no_player`, or `playback_failed`. Usage faults and
unexpected failures without a domain code remain plain tool errors.

The installed `guide` supplies current command details. The operator CLI and
library remain available for scripts and hooks; preserve their intended sound
and playback timing when adapting an existing workflow.
