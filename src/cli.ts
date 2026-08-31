#!/usr/bin/env bun
import { parse } from "./args.ts";
import { CONTRACT, type ContractCommand, findCommand } from "./contract.ts";
import { adopt, draw, type Sound, type Source, sourceSummaries } from "./draw.ts";
import { type Envelope, fail, ok, UsageError } from "./envelope.ts";
import { SoundsError } from "./errors.ts";
import { agentHelp, agentTeaser, commandHelp, topHelp } from "./help.ts";
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
  // A missing or unreadable file is the same refusal as an unparseable one: the contract
  // lists bad_recipe, and a raw ENOENT stack would be an error code it does not publish.
  let text: string;
  try {
    text = from === "-" ? await Bun.stdin.text() : await Bun.file(from).text();
  } catch (err) {
    throw new SoundsError(
      "bad_recipe",
      `cannot read ${from === "-" ? "stdin" : from}: ${(err as Error).message}`,
      "pass a file written by `agentsounds notify <source> --print`",
    );
  }
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

async function runNotify(c: ContractCommand, argv: readonly string[]): Promise<number> {
  const { args, flags } = parse(c, argv);
  const asJson = flags["json"] === true;

  if (flags["list"]) {
    const sources = sourceSummaries();
    return emit(ok({ sources }), asJson, () =>
      sources.map((s) => `  ${s.source.padEnd(14)}${s.use}`).join("\n"),
    );
  }

  // The contract's one_of constraint has already refused a call with neither.
  const from = flags["sound"];
  const source = args[0];

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

async function runTui(c: ContractCommand, argv: readonly string[]): Promise<number> {
  parse(c, argv);
  const { start } = await import("./tui/app.ts");
  await start();
  return 0;
}

function runGuide(c: ContractCommand, argv: readonly string[]): number {
  const { flags } = parse(c, argv);
  return emit(ok(CONTRACT), flags["json"] === true, () => agentHelp());
}

async function main(argv: string[]): Promise<number> {
  // Everything printed below is rendered from the contract; none of it is authored twice.
  if (argv.length === 0) {
    process.stdout.write(`${topHelp()}\n`);
    return 2;
  }
  switch (argv[0]) {
    case "--version":
      process.stdout.write(`${VERSION}\n`);
      return 0;
    case "--help":
      process.stdout.write(`${topHelp()}\n`);
      return 0;
    case "--agent-help":
      process.stdout.write(`${agentHelp()}\n`);
      return 0;
    case "--agent-teaser":
      process.stdout.write(`${agentTeaser()}\n`);
      return 0;
    case "--help-json":
      return runGuide(findCommand("guide")!, ["--json"]);
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
    process.stdout.write(`${JSON.stringify(ok(c))}\n`);
    return 0;
  }

  try {
    if (c.name === "notify") return await runNotify(c, rest);
    if (c.name === "guide") return runGuide(c, rest);
    return await runTui(c, rest);
  } catch (err) {
    if (err instanceof UsageError) usage(err.message, commandHelp(c));
    if (err instanceof SoundsError) {
      return emit(fail(err.code, err.message, err.recovery), rest.includes("--json"), () => "");
    }
    throw err;
  }
}

process.exit(await main(process.argv.slice(2)));
