#!/usr/bin/env bun
import { parse } from "./args.ts";
import { runPrepared } from "./commands.ts";
import { type ContractCommand, findCommand } from "./contract.ts";
import { type Envelope, fail, ok, UsageError } from "./envelope.ts";
import { SoundsError } from "./errors.ts";
import { agentHelp, agentTeaser, commandHelp, topHelp } from "./help.ts";
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

async function runTui(c: ContractCommand, argv: readonly string[]): Promise<number> {
  parse(c, argv);
  const { start } = await import("./tui/app.ts");
  await start();
  return 0;
}

async function runGuide(c: ContractCommand, argv: readonly string[]): Promise<number> {
  const parsed = parse(c, argv);
  const output = await runPrepared(c.name, parsed);
  return emit(output.envelope, parsed.flags["json"] === true, output.human);
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
    if (c.name === "mcp") {
      parse(c, rest);
      const { serveAgentsoundsMcp } = await import("./mcp.ts");
      await serveAgentsoundsMcp();
      return 0;
    }
    if (c.name === "notify") {
      const parsed = parse(c, rest);
      const output = await runPrepared(c.name, parsed, { readStdin: () => Bun.stdin.text() });
      return emit(output.envelope, parsed.flags["json"] === true, output.human);
    }
    if (c.name === "guide") return runGuide(c, rest);
    return await runTui(c, rest);
  } catch (err) {
    if (err instanceof UsageError) usage(err.message, commandHelp(c));
    if (err instanceof SoundsError) {
      return emit(
        fail(err.code, err.message, err.recovery),
        c.name !== "mcp" && rest.includes("--json"),
        () => "",
      );
    }
    throw err;
  }
}

process.exit(await main(process.argv.slice(2)));
