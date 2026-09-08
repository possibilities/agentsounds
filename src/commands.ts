import { type Parsed, validateParsed } from "./args.ts";
import { CONTRACT, findCommand } from "./contract.ts";
import { adopt, draw, type Sound, type Source, sourceSummaries } from "./draw.ts";
import { type Envelope, ok, UsageError } from "./envelope.ts";
import { SoundsError } from "./errors.ts";
import { agentHelp } from "./help.ts";
import { play } from "./play.ts";
import { render } from "./render.ts";
import { parseSound } from "./sounds/audio/export/snippet.ts";
import { bakeVolume } from "./sounds/audio/loudness.ts";

export interface CommandContext {
  signal?: AbortSignal;
  readStdin?: () => Promise<string>;
}
export interface CommandOutput {
  envelope: Envelope;
  human: () => string;
}
const COMMANDS: Record<
  string,
  (parsed: Parsed, context: CommandContext) => Promise<CommandOutput>
> = {
  notify: runNotify,
  guide: async () => ({ envelope: ok(CONTRACT), human: () => agentHelp() }),
};

export async function runPrepared(
  name: string,
  parsed: Parsed,
  context: CommandContext = {},
): Promise<CommandOutput> {
  const command = findCommand(name);
  const handler = COMMANDS[name];
  if (!command || !handler) throw new UsageError(`unknown producer command ${name}`);
  validateParsed(command, parsed);
  context.signal?.throwIfAborted();
  return await handler(parsed, context);
}

async function readRecipe(from: string, context: CommandContext): Promise<Sound> {
  context.signal?.throwIfAborted();
  if (from === "-" && !context.readStdin)
    throw new UsageError("stdin is the MCP transport; pass an absolute recipe path");
  // A missing or unreadable file is the same refusal as an unparseable one: the contract
  // lists bad_recipe, and a raw ENOENT stack would be an error code it does not publish.
  let text: string;
  try {
    text = from === "-" ? await context.readStdin!() : await Bun.file(from).text();
  } catch (err) {
    throw new SoundsError(
      "bad_recipe",
      `cannot read ${from === "-" ? "stdin" : from}: ${(err as Error).message}`,
      "pass a file written by `agentsounds notify <source> --print`",
    );
  }
  context.signal?.throwIfAborted();
  const parsed = parseSound(text);
  if (!parsed.ok) {
    throw new SoundsError(
      "bad_recipe",
      `${from === "-" ? "stdin" : from} is not a sound recipe: ${parsed.error}`,
      "pass a file written by `agentsounds notify <source> --print`",
    );
  }
  const label = from === "-" ? "sound" : (from.split("/").pop() ?? "sound").replace(/\.json$/, "");
  return adopt(parsed.patch, label);
}

async function runNotify(parsed: Parsed, context: CommandContext): Promise<CommandOutput> {
  const { args, flags } = parsed;

  if (flags["list"]) {
    const sources = sourceSummaries();
    return {
      envelope: ok({ sources }),
      human: () => sources.map((s) => `  ${s.source.padEnd(14)}${s.use}`).join("\n"),
    };
  }

  // The contract's one_of constraint has already refused a call with neither.
  const from = flags["sound"];
  const source = args[0];

  const sound =
    typeof from === "string"
      ? await readRecipe(from, context)
      : await draw(source as Source, {
          modality: flags["exotic"] ? "exotic" : ((flags["modality"] as "familiar") ?? "familiar"),
        });

  context.signal?.throwIfAborted();
  const reverse = flags["reverse"] === true;
  const saved = typeof flags["save"] === "string" ? flags["save"] : undefined;
  if (saved) {
    const bytes = await render(sound, { reverse });
    context.signal?.throwIfAborted();
    await Bun.write(saved, bytes);
  }
  if (flags["no-play"] !== true) await play(sound, { reverse, signal: context.signal });
  context.signal?.throwIfAborted();

  // A kept recipe carries its leveled volume BAKED IN, exactly as the product's Copy sound
  // does. Printing the raw patch would replay a kept sound at the wrong level forever.
  const recipe = bakeVolume(sound.patch, sound.volume ?? 1);

  const data = {
    name: sound.name,
    source: sound.source,
    category: sound.category,
    modality: sound.modality,
    seconds: Number(sound.seconds.toFixed(3)),
    freq: sound.freq,
    ...(saved ? { saved } : {}),
    ...(flags["print"] ? { patch: recipe } : {}),
  };
  return {
    envelope: ok(data),
    human: () => {
      if (flags["print"]) return JSON.stringify(recipe, null, 2);
      const tail = saved ? `  ${saved}` : "";
      return `${sound.name}  ${sound.seconds.toFixed(2)}s  ${sound.freq}${tail}`;
    },
  };
}
