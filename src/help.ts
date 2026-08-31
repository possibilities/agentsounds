import {
  argumentsOf,
  CONTRACT,
  type ContractArgument,
  type ContractCommand,
  TOP_LEVEL_ARGUMENTS,
} from "./contract.ts";

// Every line of help this CLI prints is rendered here from the contract. There is no
// hand-written usage string anywhere, and adding one would be the bug this file prevents.

const GUTTER = 24;

function pad(left: string): string {
  return left.length >= GUTTER - 1 ? `${left}\n${" ".repeat(GUTTER)}` : left.padEnd(GUTTER);
}

/** Wrap a paragraph so a long purpose or guidance line does not run off the terminal. */
function wrap(text: string, width = 88): string {
  return text
    .split("\n")
    .map((line) => {
      const out: string[] = [];
      let row = "";
      for (const word of line.split(" ")) {
        if (row && `${row} ${word}`.length > width) {
          out.push(row);
          row = word;
        } else row = row ? `${row} ${word}` : word;
      }
      out.push(row);
      return out.join("\n");
    })
    .join("\n");
}

function argLine(a: ContractArgument): string {
  const placeholder =
    a.positional || a.type === "boolean"
      ? ""
      : ` <${a.choices ? a.choices.join("|") : (a.format ?? "value")}>`;
  const suffix = a.default !== undefined ? ` (default ${String(a.default)})` : "";
  const choices =
    a.positional && a.choices ? `\n${" ".repeat(GUTTER)}One of: ${a.choices.join(", ")}` : "";
  return pad(`  ${a.name}${placeholder}`) + a.description + suffix + choices;
}

function signature(c: ContractCommand): string {
  const positionals = (c.arguments ?? [])
    .filter((a) => a.positional)
    .map((a) => (a.required ? `<${a.name}>` : `[${a.name}]`))
    .join(" ");
  return `agentsounds ${c.name}${positionals ? ` ${positionals}` : ""} [options]`;
}

export function commandHelp(c: ContractCommand): string {
  const own = c.arguments ?? [];
  const lines = [signature(c), "", c.summary, ""];
  if (c.guidance) lines.push(wrap(c.guidance), "");
  for (const a of own.filter((a) => a.positional)) lines.push(argLine(a));
  if (own.some((a) => a.positional)) lines.push("");
  for (const a of own.filter((a) => !a.positional)) lines.push(argLine(a));
  for (const a of argumentsOf(c).filter((a) => !own.includes(a))) lines.push(argLine(a));
  const constraints = (c.constraints ?? []).filter((k) => k.description);
  if (constraints.length > 0) {
    lines.push("");
    for (const k of constraints) lines.push(`  ${k.arguments.join(", ")}: ${k.description}`);
  }
  if (c.stdin) lines.push("", `  stdin (${c.stdin.accepts}): ${c.stdin.description}`);
  return lines.join("\n");
}

export function topHelp(): string {
  const lines = ["agentsounds <command> [options]", "", wrap(CONTRACT.meta.purpose), ""];
  for (const c of CONTRACT.commands) {
    const mark = c.audience === "agent" ? "" : `  [${c.audience}]`;
    lines.push(pad(`  ${c.name}`) + c.summary + mark);
  }
  lines.push("");
  for (const a of TOP_LEVEL_ARGUMENTS) lines.push(argLine(a));
  lines.push("", "Run `agentsounds <command> --help` for a command's options.");
  return lines.join("\n");
}

/** The conceptual layer as text: the same document `guide --json` emits, for reading. */
export function agentHelp(): string {
  const { meta, guidance, concepts } = CONTRACT;
  const lines = [
    `${meta.name} ${meta.version}`,
    "",
    wrap(meta.purpose),
    "",
    wrap(guidance),
    "",
    "Commands",
  ];
  for (const c of CONTRACT.commands) {
    const mark = c.audience === "agent" ? "" : `  [${c.audience}]`;
    lines.push(pad(`  ${c.name}`) + c.summary + mark);
  }
  if (concepts.agent_defaults?.length) {
    lines.push("", "Start with");
    for (const d of concepts.agent_defaults) lines.push(`  - ${d}`);
  }
  lines.push("", "Output");
  const { envelope, exit_codes } = concepts.output_contract;
  lines.push(`  --json: {${Object.keys(envelope).join(", ")}}`);
  for (const [code, meaning] of Object.entries(exit_codes))
    lines.push(`  exit ${code}: ${meaning}`);
  lines.push("", "Errors");
  for (const e of concepts.error_codes) {
    lines.push(pad(`  ${e.code}`) + e.meaning);
    if (e.recovery) lines.push(`${" ".repeat(GUTTER)}${e.recovery}`);
  }
  lines.push("", "Full contract: `agentsounds guide --json`.");
  return lines.join("\n");
}

export function agentTeaser(): string {
  const agentVerbs = CONTRACT.commands
    .filter((c) => c.audience === "agent")
    .map((c) => c.name)
    .join(", ");
  return `${CONTRACT.meta.name}: ${CONTRACT.meta.purpose} Verbs: ${agentVerbs}. Learn it with \`agentsounds --agent-help\`.`;
}
