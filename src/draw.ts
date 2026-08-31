import { SoundsError } from "./errors.ts";
import { measure } from "./render.ts";
import { CATEGORIES, CATEGORY_USE_CASES, type Category } from "./sounds/audio/categories.ts";
import { createFrom } from "./sounds/audio/create.ts";
import { loudnessVolume } from "./sounds/audio/loudness.ts";
import { EXPERIMENTAL_LABEL, soundName } from "./sounds/audio/naming.ts";
import { layersOf, type Patch } from "./sounds/audio/patch.ts";
import { newMemory, type ProspectSeed, prospect } from "./sounds/audio/prospect.ts";
import { buildPool, generate, type Pool } from "./sounds/audio/randomize.ts";
import { perceptualDistance } from "./sounds/audio/similarity.ts";
import { patchDuration } from "./sounds/audio/synth.ts";
import { isDeletedTwin, type TasteData, tasteScore } from "./sounds/audio/taste.ts";
import { CURATION, REFERENCE } from "./sounds/curation.ts";

/** The eight buttons of the product page: seven categories, plus the category-less draw. */
export const SOURCES = [...CATEGORIES, EXPERIMENTAL_LABEL] as const;
export type Source = (typeof SOURCES)[number];

/** The product's Familiar/Exotic toggle. `core` and `orbit` are the internal rung keys. */
export const MODALITIES = ["familiar", "exotic"] as const;
export type Modality = (typeof MODALITIES)[number];

export interface Sound {
  /** `<source>-<patchTag>`, derived from the recipe: the same recipe always names alike. */
  name: string;
  source: Source;
  /** null for an experimental draw, which answers to no category. */
  category: Category | null;
  modality: Modality | null;
  patch: Patch;
  /** The play-time loudness multiplier. Never written into the patch. */
  volume: number | undefined;
  seconds: number;
  freq: string;
}

export interface DrawOptions {
  modality?: Modality;
  /** Recent patches to steer the exotic tournament away from, newest first. */
  recent?: Patch[];
  /** Carried across draws so the experimental freshness pass can see what just played. */
  memory?: ReturnType<typeof newMemory>;
}

export function isSource(value: string): value is Source {
  return (SOURCES as readonly string[]).includes(value);
}

export function isModality(value: string): value is Modality {
  return (MODALITIES as readonly string[]).includes(value);
}

export function freqLabel(patch: Patch): string {
  for (const layer of layersOf(patch)) {
    if (layer.source.type === "noise") continue;
    const f = layer.source.frequency;
    if (typeof f === "number") return `${Math.round(f)} Hz`;
    return `${Math.round(f.start)}→${Math.round(f.end)} Hz`;
  }
  return "noise";
}

let cachedPool: Pool | null = null;

/** The curated library, built once from the vendored snapshot under the one membership formula. */
export function pool(): Pool {
  cachedPool ??= buildPool(
    REFERENCE,
    CURATION.slots,
    CURATION.approved,
    CURATION.deleted,
    CURATION.duplicates,
    CURATION.exclusions,
    CURATION.favorites,
    CURATION.toSort,
  );
  return cachedPool;
}

// The product's tournament, verbatim in behavior: 4 candidates, deleted twins discarded,
// winner SAMPLED proportional to (taste x novelty)^2 rather than picked outright, because
// argmax collapsed every pull onto the taste mode.
function pickBest<T extends { patch: Patch }>(
  make: () => T,
  catTaste: TasteData | undefined,
  recent?: Patch[],
): T {
  const contenders: T[] = [];
  for (let i = 0; contenders.length < 4 && i < 16; i++) {
    const c = make();
    if (isDeletedTwin(catTaste, c.patch)) continue;
    contenders.push(c);
  }
  if (contenders.length === 0) return make();
  const novelty = (p: Patch) => {
    if (!recent || recent.length === 0) return 1;
    const d = Math.min(...recent.map((q) => perceptualDistance(p, q)));
    return Math.min(1, Math.max(0.3, d / 0.45));
  };
  const weights = contenders.map((c) => (tasteScore(catTaste, c.patch) * novelty(c.patch)) ** 2);
  let roll = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < contenders.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) return contenders[i]!;
  }
  return contenders[contenders.length - 1]!;
}

function experimentalSeeds(p: Pool): ProspectSeed[] {
  return p.all.filter((s) => s.playable).map((s) => ({ patch: s.patch, label: s.event }));
}

/**
 * One press of one button. Draws, levels, and names; never plays.
 *
 * Leveling differs from the browser in one way and it is an improvement: the site skips the
 * offline measure on iOS and ships an unleveled sound, while here every path can measure.
 */
export async function draw(source: Source, opts: DrawOptions = {}): Promise<Sound> {
  const p = pool();

  if (source === EXPERIMENTAL_LABEL) {
    const made = prospect(opts.memory ?? newMemory(), experimentalSeeds(p), CURATION.opStats);
    const volume = loudnessVolume(CURATION.loudness, await measure(made.patch), null);
    return {
      name: soundName(EXPERIMENTAL_LABEL, made.patch),
      source,
      category: null,
      modality: null,
      patch: made.patch,
      volume,
      seconds: patchDuration(made.patch),
      freq: freqLabel(made.patch),
    };
  }

  const category = source as Category;
  const modality: Modality = opts.modality ?? "familiar";

  let patch: Patch;
  let seedId: string | undefined;
  if (modality === "familiar") {
    const r = generate(p, category);
    if (!r) throw emptyPool(category);
    patch = r.patch;
    seedId = r.seed.id;
  } else {
    const seed = generate(p, category, 0);
    if (!seed) throw emptyPool(category);
    patch = pickBest(
      () => createFrom(seed.patch, category, CURATION.opStats),
      CURATION.taste[category],
      opts.recent,
    ).patch;
  }

  // A library draw levels from the surveyed measure of its seed; only a generated one needs
  // a render. A variation nudges numbers, not level, so the seed's measure still holds.
  const known = seedId ? CURATION.loudnessMeasures[seedId] : undefined;
  const m = known ?? (await measure(patch));
  const volume = loudnessVolume(CURATION.loudness, m, category);

  return {
    name: soundName(category, patch),
    source,
    category,
    modality,
    patch,
    volume,
    seconds: patchDuration(patch),
    freq: freqLabel(patch),
  };
}

/** Wrap a recipe that came from somewhere else (a saved file, a paste) as a playable Sound. */
export function adopt(patch: Patch, label = "sound"): Sound {
  return {
    name: soundName(label, patch),
    source: EXPERIMENTAL_LABEL,
    category: null,
    modality: null,
    patch,
    volume: undefined,
    seconds: patchDuration(patch),
    freq: freqLabel(patch),
  };
}

function emptyPool(category: Category): SoundsError {
  return new SoundsError(
    "empty_pool",
    `no curated sounds are available for "${category}"`,
    "agentsounds notify --list shows the sources that have sounds",
  );
}

/** The `notify --list` payload: each source and what it is for. */
export function sourceSummaries(): { source: string; use: string }[] {
  return SOURCES.map((s) => ({
    source: s,
    use:
      s in CATEGORY_USE_CASES
        ? CATEGORY_USE_CASES[s as keyof typeof CATEGORY_USE_CASES]
        : "category-agnostic draws from five engines at once",
  }));
}
