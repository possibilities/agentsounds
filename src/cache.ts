import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

// Rendered WAVs keyed by the sound's derived name, which is a hash of the recipe: the same
// recipe is the same file, so replaying a saved sound skips synthesis entirely and costs one
// afplay spawn. Not a correctness path - a miss just renders.
const DIR = process.env["AGENTSOUNDS_CACHE"] ?? join(homedir(), ".cache", "agentsounds");

export function cachePath(name: string): string {
  return join(DIR, `${name}.wav`);
}

export async function readCached(name: string): Promise<string | null> {
  const path = cachePath(name);
  return (await Bun.file(path).exists()) ? path : null;
}

export async function writeCached(name: string, bytes: Uint8Array): Promise<string> {
  const path = cachePath(name);
  await mkdir(DIR, { recursive: true });
  await Bun.write(path, bytes);
  return path;
}
