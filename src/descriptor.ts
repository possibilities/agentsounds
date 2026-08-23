import { MODALITIES, SOURCES } from "./draw.ts";
import { CATEGORY_USE_CASES } from "./sounds/audio/categories.ts";

export type FlagType = "boolean" | "string";

export interface FlagDescriptor {
  name: string;
  type: FlagType;
  summary: string;
  allowed?: readonly string[];
}

export interface ArgDescriptor {
  name: string;
  summary: string;
  allowed?: readonly string[];
  required: boolean;
}

export interface CommandDescriptor {
  name: string;
  summary: string;
  args: readonly ArgDescriptor[];
  flags: readonly FlagDescriptor[];
}

const HELP_FLAGS = [
  { name: "help", type: "boolean", summary: "Show human help" },
  { name: "help-json", type: "boolean", summary: "Show machine-readable help" },
  { name: "json", type: "boolean", summary: "Emit a machine-readable envelope" },
] as const satisfies readonly FlagDescriptor[];

export const TOP_LEVEL_FLAGS = [
  { name: "help", type: "boolean", summary: "Show human help" },
  { name: "help-json", type: "boolean", summary: "Show machine-readable help" },
  { name: "version", type: "boolean", summary: "Show the version" },
] as const satisfies readonly FlagDescriptor[];

// `notify` is a namespace, not the only verb it will ever hold: the sound engines behind
// Craft, Invent and the library browser are all still upstream waiting for a subcommand.
export const COMMANDS = [
  {
    name: "notify",
    summary: "Draw a sound for a source and play it",
    args: [
      {
        name: "source",
        summary: `Which sound to draw: ${SOURCES.join(", ")}`,
        allowed: SOURCES,
        required: true,
      },
    ],
    flags: [
      ...HELP_FLAGS,
      {
        name: "exotic",
        type: "boolean",
        summary: "Draw with the remix engine instead of the curated library",
      },
      {
        name: "modality",
        type: "string",
        summary: `Draw modality: ${MODALITIES.join("|")} (default familiar)`,
        allowed: MODALITIES,
      },
      {
        name: "sound",
        type: "string",
        summary: "Play a saved recipe instead of drawing (- for stdin)",
      },
      { name: "save", type: "string", summary: "Write the sound to a WAV file" },
      { name: "print", type: "boolean", summary: "Print the recipe as JSON, to keep and replay" },
      { name: "reverse", type: "boolean", summary: "Play the sound backwards" },
      { name: "no-play", type: "boolean", summary: "Do not play; only save or print" },
      { name: "list", type: "boolean", summary: "List the sources and what each is for" },
    ],
  },
  {
    name: "tui",
    summary: "Browse and audition sounds interactively",
    args: [],
    flags: [...HELP_FLAGS],
  },
] as const satisfies readonly CommandDescriptor[];

export type CommandName = (typeof COMMANDS)[number]["name"];

export function findCommand(name: string): CommandDescriptor | undefined {
  return COMMANDS.find((c) => c.name === name);
}

export function sourceSummaries(): { source: string; use: string }[] {
  return SOURCES.map((s) => ({
    source: s,
    use:
      s in CATEGORY_USE_CASES
        ? CATEGORY_USE_CASES[s as keyof typeof CATEGORY_USE_CASES]
        : "category-agnostic draws from five engines at once",
  }));
}

function flagLine(f: FlagDescriptor): string {
  const arg = f.type === "string" ? " <value>" : "";
  return `  --${f.name}${arg}`.padEnd(24) + f.summary;
}

export function commandHelp(c: CommandDescriptor): string {
  const args = c.args.map((a) => (a.required ? `<${a.name}>` : `[${a.name}]`)).join(" ");
  const lines = [`agentsounds ${c.name}${args ? ` ${args}` : ""}`, "", c.summary, ""];
  for (const a of c.args) {
    lines.push(`  ${a.name}`.padEnd(24) + a.summary);
  }
  if (c.args.length > 0) lines.push("");
  for (const f of c.flags) lines.push(flagLine(f));
  return lines.join("\n");
}

export function topHelp(): string {
  const lines = [
    "agentsounds <command> [options]",
    "",
    "Procedural UI sounds for the terminal.",
    "",
  ];
  for (const c of COMMANDS) lines.push(`  ${c.name}`.padEnd(24) + c.summary);
  lines.push("");
  for (const f of TOP_LEVEL_FLAGS) lines.push(flagLine(f));
  lines.push("", "Run `agentsounds <command> --help` for a command's options.");
  return lines.join("\n");
}

export function helpJson(): unknown {
  return {
    name: "agentsounds",
    flags: TOP_LEVEL_FLAGS,
    commands: COMMANDS.map((c) => ({
      name: c.name,
      summary: c.summary,
      args: c.args,
      flags: c.flags,
    })),
  };
}
