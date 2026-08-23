import type { OpStats } from "./audio/create.ts";
import type { PoolBucket } from "./audio/categories.ts";
import { withLoudnessDefaults, type LoudnessConfig } from "./audio/loudness.ts";
import type { Patch } from "./audio/patch.ts";
import type { ApprovedPools, Exclusions, ReferenceData, SlotOverrides } from "./audio/randomize.ts";
import type { TasteStore } from "./audio/taste.ts";

import tap from "./data/tap.json";
import hover from "./data/hover.json";
import transition from "./data/transition.json";
import success from "./data/success.json";
import error from "./data/error.json";
import warning from "./data/warning.json";
import notification from "./data/notification.json";
import unsorted from "./data/unsorted.json";
import slots from "./data/slots.json";
import deleted from "./data/deleted.json";
import duplicates from "./data/duplicates.json";
import exclusions from "./data/exclusions.json";
import favorites from "./data/favorites.json";
import tosort from "./data/tosort.json";
import creationsFeedback from "./data/creations-feedback.json";
import taste from "./data/taste.json";
import loudness from "./data/loudness.json";
import referenceJson from "./data/reference/reference-sounds.json";

// Mirrors procedural-sounds' lib/curation.ts: the curated library frozen into the bundle.
// There is no /api here at all, so this is the only state there has ever been. A pool file
// the draw reads MUST be imported here, or it ships as its empty default and the draw
// silently runs on raw imports.
const buckets: Record<PoolBucket, Patch[]> = {
  tap: tap as Patch[],
  hover: hover as Patch[],
  transition: transition as Patch[],
  success: success as Patch[],
  error: error as Patch[],
  warning: warning as Patch[],
  notification: notification as Patch[],
  unsorted: unsorted as Patch[],
};

export interface CurationSnapshot {
  slots: SlotOverrides;
  approved: ApprovedPools;
  deleted: string[];
  duplicates: string[];
  exclusions: Exclusions;
  favorites: string[];
  toSort: string[];
  opStats: OpStats;
  taste: TasteStore;
  loudness: LoudnessConfig;
  loudnessMeasures: Record<string, { winDb: number; peakDb: number }>;
}

export const REFERENCE = referenceJson as unknown as ReferenceData;

export const CURATION: CurationSnapshot = {
  slots: slots as SlotOverrides,
  approved: buckets,
  deleted: deleted as string[],
  duplicates: duplicates as string[],
  exclusions: exclusions as Exclusions,
  favorites: favorites as string[],
  toSort: tosort as string[],
  opStats: creationsFeedback as OpStats,
  taste: taste as unknown as TasteStore,
  loudness: withLoudnessDefaults((loudness as { config?: Partial<LoudnessConfig> }).config),
  loudnessMeasures:
    (loudness as { measures?: Record<string, { winDb: number; peakDb: number }> }).measures ?? {},
};
