import { MODALITIES, SOURCES } from "./draw.ts";
import { VERSION } from "./version.ts";

// The fleet agent contract, version 1: the one authored description of this CLI.
// `guide --json` emits it verbatim; `--help`, `--agent-help`, `--agent-teaser` and
// `--help-json` are renders of it, and the argv parser validates against it. Nothing
// about a command, a flag or an error code may be written down anywhere else — a
// second authorship is exactly what this document exists to delete.

export type ArgumentType = "string" | "boolean" | "integer" | "number";

export interface ContractArgument {
  name: string;
  type: ArgumentType;
  description: string;
  format?: "path" | "url" | "duration" | "ref" | "json";
  direction?: "in" | "out";
  required?: boolean;
  positional?: boolean;
  repeatable?: boolean;
  choices?: readonly string[];
  default?: unknown;
  aliases?: readonly string[];
}

export interface ContractConstraint {
  kind: "one_of" | "conflicts" | "requires";
  arguments: readonly string[];
  required?: boolean;
  description?: string;
}

export interface ContractStdin {
  accepts: "text" | "json";
  required?: boolean;
  description: string;
}

export interface ContractCommand {
  name: string;
  summary: string;
  audience: "agent" | "operator" | "internal";
  mutates?: boolean;
  guidance?: string;
  arguments?: readonly ContractArgument[];
  subcommands?: readonly ContractCommand[];
  stdin?: ContractStdin;
  constraints?: readonly ContractConstraint[];
}

export interface Contract {
  contract_version: 1;
  meta: { name: string; version: string; purpose: string; audience: "agent" | "operator" };
  guidance: string;
  concepts: {
    model?: Record<string, unknown>;
    output_contract: {
      envelope: Record<string, string>;
      exit_codes: Record<string, string>;
    };
    error_codes: readonly { code: string; meaning: string; recovery?: string }[];
    read_only_commands?: readonly string[];
    agent_defaults?: readonly string[];
  };
  global_arguments: readonly ContractArgument[];
  commands: readonly ContractCommand[];
}

export const CONTRACT: Contract = {
  contract_version: 1,
  meta: {
    name: "agentsounds",
    version: VERSION,
    purpose:
      "Procedural UI sounds for the terminal: taps, hovers, transitions, success, error, warning and notification sounds synthesized live from recipes, with no audio files anywhere.",
    audience: "agent",
  },
  guidance: [
    "Play a sound with `notify <source>`. Every press is a fresh draw from the source's pool, so the same command sounds different each time — that is the design, not a bug, and there is deliberately no seed or preset flag.",
    "When a sound has to be recognizable across a day of use — a hook, a script, anything that fires repeatedly — keep it once and replay it: `notify success --print > done.json`, then `notify --sound done.json`. A printed recipe carries its leveled volume baked in, so it replays exactly as it sounded when it was picked. A WAV is the wrong keepsake; the recipe re-renders anywhere.",
    "`--exotic` rebuilds a library sound into a new structure. Reach for it when the curated sounds feel too safe, not by default. Shopping for a sound by ear is `tui`, which is interactive and for a human.",
  ].join("\n\n"),
  concepts: {
    model: {
      source:
        "One of the eight buttons: seven categories plus `experimental`, which answers to no category and draws from five engines at once.",
      modality:
        "`familiar` draws from the curated library; `exotic` remixes a library sound by learned taste.",
      draw: "A single generated sound. Fresh every call; nothing is a preset.",
      recipe:
        "The JSON patch a sound is synthesized from — layers, envelopes, filters, effects. The only durable form of a sound.",
    },
    output_contract: {
      envelope: {
        schema_version: "number",
        ok: "boolean",
        error: "{code,message,recovery} | null",
        data: "payload | null",
      },
      exit_codes: {
        "0": "success",
        "1": "domain failure, reported as an ok:false envelope",
        "2": "usage fault: help on stderr, never an envelope",
      },
    },
    error_codes: [
      {
        code: "empty_pool",
        meaning: "No curated sounds are available for that source.",
        recovery: "`agentsounds notify --list` shows the sources that have sounds.",
      },
      {
        code: "bad_recipe",
        meaning: "The file given to --sound is not a sound recipe.",
        recovery: "Pass a file written by `agentsounds notify <source> --print`.",
      },
      {
        code: "no_player",
        meaning: "No audio player was found on this system.",
        recovery: "Install afplay, paplay, aplay or ffplay, or use --save to write a WAV.",
      },
      {
        code: "playback_failed",
        meaning: "The audio player exited non-zero.",
        recovery: "Check that an output device is available, or use --save to write a WAV.",
      },
    ],
    read_only_commands: ["guide"],
    agent_defaults: [
      "`notify --list` before picking a source, when the choice is not obvious.",
      "Keep a recipe with --print for anything that fires more than once.",
    ],
  },
  global_arguments: [
    {
      name: "--json",
      type: "boolean",
      description: "Emit the envelope on stdout instead of a human line. Preferred for agents.",
    },
    {
      name: "--help",
      type: "boolean",
      description: "Show help for the command, or for the CLI when given first.",
    },
    {
      name: "--help-json",
      type: "boolean",
      description: "Alias for `guide --json`: the full contract as one envelope.",
    },
    {
      name: "--version",
      type: "boolean",
      description: "Print the version. Top level only.",
    },
    {
      name: "--agent-help",
      type: "boolean",
      description: "Render the contract's guidance and concepts as text. Top level only.",
    },
    {
      name: "--agent-teaser",
      type: "boolean",
      description: "One line naming the tool and how to learn it. Top level only.",
    },
  ],
  commands: [
    // `notify` is a namespace, not the only verb it will ever hold: the sound engines behind
    // Craft, Invent and the library browser are all still upstream waiting for a subcommand.
    {
      name: "notify",
      summary: "Draw a sound for a source and play it",
      audience: "agent",
      mutates: true,
      guidance:
        "Plays through the system audio device and caches the rendered WAV, so it is never a pure read. Give a source to draw a new sound, --sound to replay a kept recipe, or --list to see what the sources are for.",
      stdin: {
        accepts: "json",
        required: false,
        description: "A kept recipe, when --sound is `-`. A file path is always accepted instead.",
      },
      arguments: [
        {
          name: "source",
          type: "string",
          description: "Which sound to draw",
          positional: true,
          choices: SOURCES,
        },
        {
          name: "--exotic",
          type: "boolean",
          description: "Shorthand for --modality exotic: the remix engine, not the library",
        },
        {
          name: "--modality",
          type: "string",
          description:
            "Draw from the curated library (familiar) or remix one of its sounds (exotic)",
          choices: MODALITIES,
          default: "familiar",
        },
        {
          name: "--sound",
          type: "string",
          description: "Play a saved recipe instead of drawing; `-` reads it from stdin",
          format: "path",
          direction: "in",
        },
        {
          name: "--save",
          type: "string",
          description: "Write the sound to this WAV file, overwriting it",
          format: "path",
          direction: "out",
        },
        {
          name: "--print",
          type: "boolean",
          description: "Print the recipe as JSON, to keep and replay",
        },
        { name: "--reverse", type: "boolean", description: "Play the sound backwards" },
        { name: "--no-play", type: "boolean", description: "Do not play; only save or print" },
        {
          name: "--list",
          type: "boolean",
          description: "List the sources and what each is for",
        },
      ],
      constraints: [
        {
          kind: "one_of",
          arguments: ["source", "--sound", "--list"],
          required: true,
          description: "notify needs a source, a saved recipe (--sound), or --list",
        },
        {
          kind: "conflicts",
          arguments: ["--sound", "--exotic"],
          description: "a saved recipe replays as recorded; there is nothing to draw",
        },
        {
          kind: "conflicts",
          arguments: ["--sound", "--modality"],
          description: "a saved recipe replays as recorded; there is nothing to draw",
        },
        {
          kind: "conflicts",
          arguments: ["--exotic", "--modality"],
          description: "--exotic is the exotic modality; do not spell it twice",
        },
      ],
    },
    {
      name: "tui",
      summary: "Browse and audition sounds interactively",
      audience: "operator",
      mutates: true,
      guidance:
        "A full-screen terminal app a human drives by ear. It takes over the terminal and never returns structured output, so an agent should not launch it.",
      arguments: [],
    },
    {
      name: "guide",
      summary: "Print this CLI's agent contract",
      audience: "agent",
      mutates: false,
      guidance: "`guide --json` is the machine-readable form; bare `guide` renders it as text.",
      arguments: [],
    },
  ],
};

// Three of the globals are only meaningful before a command name: there is no per-command
// version, and the agent renders describe the whole CLI.
const TOP_LEVEL_ONLY = new Set(["--version", "--agent-help", "--agent-teaser"]);

/** The flag spellings every command accepts, minus the top-level-only ones. */
export const GLOBAL_ARGUMENTS: readonly ContractArgument[] = CONTRACT.global_arguments.filter(
  (a) => !TOP_LEVEL_ONLY.has(a.name),
);

/** The flags the top-level help lists. `--json` belongs to a command's output, not to argv. */
export const TOP_LEVEL_ARGUMENTS: readonly ContractArgument[] = CONTRACT.global_arguments.filter(
  (a) => a.name !== "--json",
);

export function findCommand(name: string): ContractCommand | undefined {
  return CONTRACT.commands.find((c) => c.name === name);
}

/** Every argument a command accepts: its own, plus the globals. */
export function argumentsOf(c: ContractCommand): readonly ContractArgument[] {
  return [...(c.arguments ?? []), ...GLOBAL_ARGUMENTS];
}

/** The record key a flag parses into: `--no-play` becomes `no-play`. */
export function flagKey(name: string): string {
  return name.replace(/^--/, "");
}
