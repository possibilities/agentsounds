import "./audio-host.ts";

import type { Sound } from "./draw.ts";
import { encodeWav, trimAndFade } from "./sounds/audio/export/wav.ts";
import { invertPatch } from "./sounds/audio/invert.ts";
import { bakeVolume } from "./sounds/audio/loudness.ts";
import { type LoudnessMeasure, measurePatch, renderToBuffer } from "./sounds/audio/offline.ts";
import type { Patch } from "./sounds/audio/patch.ts";

export interface RenderOptions {
  /** Play the recipe backwards, the product stage's reverse control. */
  reverse?: boolean;
  sampleRate?: number;
}

/** Offline peak/RMS measurement, the input to loudness leveling. */
export async function measure(patch: Patch): Promise<LoudnessMeasure> {
  return measurePatch(patch);
}

/**
 * A sound as WAV bytes, with its leveled volume baked into the layer gains so the file is
 * exactly what was heard. A noise layer draws fresh grains per render, so two renders of one
 * recipe are the same sound and not the same samples.
 */
export async function render(sound: Sound, opts: RenderOptions = {}): Promise<Uint8Array> {
  const rate = opts.sampleRate ?? 44100;
  const patch = opts.reverse ? invertPatch(sound.patch) : sound.patch;
  const buffer = await renderToBuffer(bakeVolume(patch, sound.volume ?? 1), rate);
  const samples = trimAndFade(buffer.getChannelData(0).slice(), buffer.sampleRate);
  return new Uint8Array(encodeWav(samples, buffer.sampleRate));
}

/** `success-8c1e3.wav` - reproducible from the recipe alone, so an export is findable. */
export function wavFilename(sound: Sound): string {
  return `${sound.name}.wav`;
}
