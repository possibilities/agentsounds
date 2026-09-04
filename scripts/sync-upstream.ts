#!/usr/bin/env bun
// Re-vendor the sound engine from a procedural-sounds checkout.
//
// The vendored tree under src/sounds/ is byte-identical to upstream on purpose: that is what
// makes a headless render provably the same node graph the browser builds, and what makes a
// re-sync a diff instead of an archaeology dig. Nothing here edits upstream code. The one
// thing that would break byte-identity is an import alias, and there is exactly one
// (limits.ts reaching for @/data/pool/limits.json); tsconfig maps it rather than rewriting it.

import { mkdir, readdir, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const UPSTREAM =
  process.env["PROCEDURAL_SOUNDS"] ?? join(homedir(), "source", "m1ckc3s--procedural-sounds");
const HERE = join(import.meta.dir, "..");
const STAMP = join(HERE, "src", "sounds", "UPSTREAM");

async function copyTree(from: string, to: string, filter: (f: string) => boolean) {
  await mkdir(to, { recursive: true });
  for (const entry of await readdir(from, { withFileTypes: true })) {
    if (entry.isDirectory()) continue;
    if (!filter(entry.name)) continue;
    await Bun.write(join(to, entry.name), Bun.file(join(from, entry.name)));
  }
}

async function head(): Promise<string> {
  const proc = Bun.spawn(["git", "-C", UPSTREAM, "rev-parse", "HEAD"], { stdout: "pipe" });
  if ((await proc.exited) !== 0) throw new Error(`${UPSTREAM} is not a git checkout`);
  return (await new Response(proc.stdout).text()).trim();
}

async function changed(): Promise<string[]> {
  const proc = Bun.spawn(["git", "-C", HERE, "status", "--porcelain", "src/sounds"], {
    stdout: "pipe",
  });
  await proc.exited;
  return (await new Response(proc.stdout).text()).trim().split("\n").filter(Boolean);
}

const before = await Bun.file(STAMP)
  .text()
  .catch(() => "");

const ts = /\.ts$/;
const json = /\.json$/;

await rm(join(HERE, "src/sounds/audio"), { recursive: true, force: true });
await copyTree(join(UPSTREAM, "lib/audio"), join(HERE, "src/sounds/audio"), (f) => ts.test(f));
await copyTree(join(UPSTREAM, "lib/audio/export"), join(HERE, "src/sounds/audio/export"), (f) =>
  ts.test(f),
);
await copyTree(join(UPSTREAM, "data/pool"), join(HERE, "src/sounds/data"), (f) => json.test(f));
await copyTree(
  join(UPSTREAM, "data/reference"),
  join(HERE, "src/sounds/data/reference"),
  (f) => json.test(f) || f === "UPSTREAM-LICENSE",
);

const commit = await head();
await Bun.write(STAMP, `${commit}\n`);

const drift = await changed();
console.log(`upstream ${UPSTREAM}`);
console.log(`  was ${before.trim() || "(unrecorded)"}`);
console.log(`  now ${commit}`);
console.log(drift.length === 0 ? "  no drift" : `  ${drift.length} file(s) changed:`);
for (const line of drift.slice(0, 40)) console.log(`    ${line}`);
if (drift.length > 40) console.log(`    ... and ${drift.length - 40} more`);
console.log(
  "\nRun `bun run check` before committing: upstream may have widened the Patch surface.",
);
