// agentsounds: procedural UI sounds, generated and played from a terminal.
//
// The model is the procedural-sounds product page: pick a SOURCE (seven categories plus the
// category-less experimental draw), pick a MODALITY (familiar or exotic), and press. Every
// press draws a fresh sound, levels it, and names it after its own recipe. Keeping one means
// keeping the recipe.

export type { DrawOptions, Modality, Sound, Source } from "./draw.ts";
export { adopt, draw, freqLabel, isModality, isSource, MODALITIES, pool, SOURCES } from "./draw.ts";
export { SoundsError } from "./errors.ts";
export type { PlayOptions } from "./play.ts";
export { play } from "./play.ts";
export type { RenderOptions } from "./render.ts";
export { measure, render, wavFilename } from "./render.ts";
export type { Category } from "./sounds/audio/categories.ts";
export { CATEGORIES, CATEGORY_USE_CASES } from "./sounds/audio/categories.ts";
export type { ParsedSound } from "./sounds/audio/export/snippet.ts";
export { PLAYER_JS, parseSound, toSnippet, toSoundJs } from "./sounds/audio/export/snippet.ts";
export type { Patch } from "./sounds/audio/patch.ts";
export { newMemory } from "./sounds/audio/prospect.ts";

import { type DrawOptions, draw, type Sound, type Source } from "./draw.ts";
import { type PlayOptions, play } from "./play.ts";

export interface NotifyOptions extends DrawOptions, PlayOptions {}

/** Draw a sound for a source and play it: one press of one button. */
export async function notify(source: Source, opts: NotifyOptions = {}): Promise<Sound> {
  const sound = await draw(source, opts);
  await play(sound, opts);
  return sound;
}
