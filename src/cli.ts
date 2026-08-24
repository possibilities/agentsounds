#!/usr/bin/env bun
import { parse } from "./args.ts";
import {
  type CommandDescriptor,
  commandHelp,
  findCommand,
  helpJson,
  sourceSummaries,
  topHelp,
} from "./descriptor.ts";
import { adopt, draw, type Sound, type Source } from "./draw.ts";
import { type Envelope, fail, ok, UsageError } from "./envelope.ts";
import { SoundsError } from "./errors.ts";
import { play } from "./play.ts";
import { render } from "./render.ts";
import { parseSound } from "./sounds/audio/export/snippet.ts";
import { bakeVolume } from "./sounds/audio/loudness.ts";
import { VERSION } from "./version.ts";

function usage(message: string, help: string): never {
  process.stderr.write(`${message}\n\n${help}\n`);
  process.exit(2);
}

function emit(env: Envelope, asJson: boolean, human: () => string): number {
  if (asJson) {
    process.stdout.write(`${JSON.stringify(env)}\n`);
  } else if (env.ok) {
    const text = human();
    if (text) process.stdout.write(`${text}\n`);
  } else {
    process.stderr.write(`${env.error!.message}\n${env.error!.recovery}\n`);
  }
  return env.ok ? 0 : 1;
}

async function readRecipe(from: string): Promise<Sound> {
  const text = from === "-" ? await Bun.stdin.text() : await Bun.file(from).text();
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

async function runNotify(c: CommandDescriptor, argv: readonly string[]): Promise<number> {
  const relaxed = argv.includes("--list") || argv.includes("--sound");
  const { args, flags } = parse(c, argv, !relaxed);
  const asJson = flags["json"] === true;

  if (flags["list"]) {
    const sources = sourceSummaries();
    return emit(ok({ sources }), asJson, () =>
      sources.map((s) => `  ${s.source.padEnd(14)}${s.use}`).join("\n"),
    );
  }

  const from = flags["sound"];
  const source = args[0];
  if (typeof from !== "string" && source === undefined) {
    usage("notify needs a source, or --sound to replay a saved recipe", commandHelp(c));
  }

  const sound =
    typeof from === "string"
      ? await readRecipe(from)
      : await draw(source as Source, {
          modality: flags["exotic"] ? "exotic" : ((flags["modality"] as "familiar") ?? "familiar"),
        });

  const reverse = flags["reverse"] === true;
  const saved = typeof flags["save"] === "string" ? flags["save"] : undefined;
  if (saved) await Bun.write(saved, await render(sound, { reverse }));
  if (flags["no-play"] !== true) await play(sound, { reverse });

  // A kept recipe carries its leveled volume BAKED IN, exactly as the product's Copy sound
  // does. Printing the raw patch would replay a kept sound at the wrong level forever.
  const recipe = bakeVolume(sound.patch, sound.volume ?? 1);

  // --print goes to stdout alone so `--print > done.json` yields a clean recipe file.
  if (flags["print"] && !asJson) {
    process.stdout.write(`${JSON.stringify(recipe, null, 2)}\n`);
    return 0;
  }

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
  return emit(ok(data), asJson, () => {
    const tail = saved ? `  ${saved}` : "";
    return `${sound.name}  ${sound.seconds.toFixed(2)}s  ${sound.freq}${tail}`;
  });
}

async function runTui(c: CommandDescriptor, argv: readonly string[]): Promise<number> {
  parse(c, argv);
  const { start } = await import("./tui/app.ts");
  await start();
  return 0;
}

async function main(argv: string[]): Promise<number> {
  if (argv.includes("--version") && argv[0] === "--version") {
    process.stdout.write(`${VERSION}\n`);
    return 0;
  }
  if (argv.length === 0 || argv[0] === "--help") {
    process.stdout.write(`${topHelp()}\n`);
    return argv.length === 0 ? 2 : 0;
  }
  if (argv[0] === "--help-json") {
    process.stdout.write(`${JSON.stringify(helpJson())}\n`);
    return 0;
  }

  const name = argv[0]!;
  const c = findCommand(name);
  if (!c) usage(`unknown command "${name}"`, topHelp());

  const rest = argv.slice(1);
  if (rest.includes("--help")) {
    process.stdout.write(`${commandHelp(c)}\n`);
    return 0;
  }
  if (rest.includes("--help-json")) {
    process.stdout.write(`${JSON.stringify(c)}\n`);
    return 0;
  }

  try {
    return c.name === "notify" ? await runNotify(c, rest) : await runTui(c, rest);
  } catch (err) {
    if (err instanceof UsageError) usage(err.message, commandHelp(c));
    if (err instanceof SoundsError) {
      return emit(fail(err.code, err.message, err.recovery), rest.includes("--json"), () => "");
    }
    throw err;
  }
}

process.exit(await main(process.argv.slice(2)));
