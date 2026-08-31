import { describe, expect, test } from "bun:test";
import { existsSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "../src/args.ts";
import {
  argumentsOf,
  CONTRACT,
  type ContractCommand,
  findCommand,
  flagKey,
} from "../src/contract.ts";
import { agentHelp, agentTeaser, commandHelp, topHelp } from "../src/help.ts";

const CLI = join(import.meta.dir, "..", "src", "cli.ts");

function leaves(
  commands: readonly ContractCommand[],
  prefix: string[] = [],
): [string, ContractCommand][] {
  return commands.flatMap((c) =>
    c.subcommands
      ? leaves(c.subcommands, [...prefix, c.name])
      : [[[...prefix, c.name].join(" "), c]],
  );
}

describe("guide --json", () => {
  test("emits the contract inside the house envelope", () => {
    const run = Bun.spawnSync(["bun", CLI, "guide", "--json"], { stdout: "pipe", stderr: "pipe" });
    expect(run.exitCode).toBe(0);
    const env = JSON.parse(run.stdout.toString());
    expect(env.ok).toBe(true);
    expect(env.error).toBe(null);
    expect(env.data.contract_version).toBe(1);
    expect(env.data.meta.name).toBe("agentsounds");
    expect(env.data.commands.map((c: { name: string }) => c.name)).toEqual(
      CONTRACT.commands.map((c) => c.name),
    );
  });

  // The fleet's own validator executes agentstart's normative schema. It is the authority;
  // this test only asks it. When that checkout is not on this machine the test says so
  // rather than mirroring the schema here, which is the duplication the contract exists
  // to delete.
  test("conforms to the fleet agent contract", () => {
    const validator =
      process.env["AGENT_CONTRACT_VALIDATOR"] ??
      join(homedir(), "code", "agentstart", "scripts", "validate-agent-contract.ts");
    if (!existsSync(validator)) {
      console.warn(`skipped: no agent-contract validator at ${validator}`);
      return;
    }
    const guide = Bun.spawnSync(["bun", CLI, "guide", "--json"], { stdout: "pipe" });
    const file = join(tmpdir(), "agentsounds-contract.json");
    writeFileSync(file, guide.stdout.toString());
    const run = Bun.spawnSync(["bun", validator, "--file", file], {
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(`${run.stdout.toString()}${run.stderr.toString()}`).toContain("conforms to version 1");
    expect(run.exitCode).toBe(0);
  });
});

describe("the contract is internally consistent", () => {
  test("read_only_commands is exactly the non-mutating leaves", () => {
    const readOnly = leaves(CONTRACT.commands)
      .filter(([, c]) => c.mutates === false)
      .map(([path]) => path);
    expect([...(CONTRACT.concepts.read_only_commands ?? [])].sort()).toEqual(readOnly.sort());
  });

  test("every constraint names arguments its command accepts", () => {
    for (const [path, c] of leaves(CONTRACT.commands)) {
      const names = argumentsOf(c).map((a) => a.name);
      for (const k of c.constraints ?? []) {
        for (const name of k.arguments)
          expect([path, names]).toEqual([path, expect.arrayContaining([name])]);
      }
    }
  });

  test("the parser accepts every flag the contract declares", () => {
    for (const [, c] of leaves(CONTRACT.commands)) {
      for (const a of argumentsOf(c)) {
        if (a.positional || a.name === "--help" || a.name === "--help-json") continue;
        const argv = a.type === "boolean" ? [a.name] : [a.name, a.choices?.[0] ?? "x"];
        // Constraints may still refuse the combination; an unknown flag never does.
        try {
          const parsed = parse(c, argv);
          expect(parsed.flags[flagKey(a.name)]).toBeDefined();
        } catch (e) {
          expect((e as Error).message).not.toContain("unknown flag");
        }
      }
    }
  });
});

describe("the renders come from the contract", () => {
  test("agent help carries the guidance, the errors and the exit codes", () => {
    const help = agentHelp();
    // Wrapped for the terminal, so compare on a phrase rather than a whole paragraph.
    expect(help.replace(/\s+/g, " ")).toContain(CONTRACT.guidance.split("\n\n")[0]!);
    for (const e of CONTRACT.concepts.error_codes) expect(help).toContain(e.code);
    for (const code of Object.keys(CONTRACT.concepts.output_contract.exit_codes)) {
      expect(help).toContain(`exit ${code}`);
    }
  });

  test("the teaser names the agent verbs and nothing human-only", () => {
    expect(agentTeaser()).toContain("notify");
    expect(agentTeaser()).not.toContain("tui");
  });

  test("top help marks the commands an agent should not call", () => {
    expect(topHelp()).toContain("[operator]");
  });

  test("command help renders each command's own summary", () => {
    for (const [, c] of leaves(CONTRACT.commands)) {
      expect(commandHelp(c)).toContain(c.summary);
    }
    expect(findCommand("tui")).toBeDefined();
  });
});
