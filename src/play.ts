import { readCached, writeCached } from "./cache.ts";
import type { Sound } from "./draw.ts";
import { SoundsError } from "./errors.ts";
import { type RenderOptions, render } from "./render.ts";

// Playback is a rendered WAV handed to the platform's own player. No realtime graph, no
// native audio binding: the synthesis already happened offline, and a spawn is the whole
// cost. afplay ships with macOS; the others are the usual Linux fallbacks.
const PLAYERS = [
  { cmd: "afplay", args: (f: string) => [f] },
  { cmd: "paplay", args: (f: string) => [f] },
  { cmd: "aplay", args: (f: string) => ["-q", f] },
  { cmd: "ffplay", args: (f: string) => ["-nodisp", "-autoexit", "-loglevel", "quiet", f] },
] as const;

let resolved: (typeof PLAYERS)[number] | null | undefined;

function findPlayer(): (typeof PLAYERS)[number] | null {
  if (resolved !== undefined) return resolved;
  resolved = PLAYERS.find((p) => Bun.which(p.cmd) !== null) ?? null;
  return resolved;
}

export interface PlayOptions extends RenderOptions {
  /** Render and cache but do not spawn a player. */
  silent?: boolean;
}

/** Render the sound to a cached WAV and play it. Returns the file that was played. */
export async function play(sound: Sound, opts: PlayOptions = {}): Promise<string> {
  // A reversed render is a different sound and must not overwrite the forward one's cache.
  const key = opts.reverse ? `${sound.name}-reverse` : sound.name;
  const hit = await readCached(key);
  const file = hit ?? (await writeCached(key, await render(sound, opts)));
  if (opts.silent) return file;

  const player = findPlayer();
  if (!player) {
    throw new SoundsError(
      "no_player",
      "no audio player was found on this system",
      "install one of afplay, paplay, aplay, or ffplay, or use --save to write the WAV",
    );
  }
  const proc = Bun.spawn([player.cmd, ...player.args(file)], { stdout: "ignore", stderr: "pipe" });
  const code = await proc.exited;
  if (code !== 0) {
    throw new SoundsError(
      "playback_failed",
      `${player.cmd} exited with code ${code}`,
      "check that an audio output device is available, or use --save to write the WAV",
    );
  }
  return file;
}
