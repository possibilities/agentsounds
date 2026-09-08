/** Contract-to-MCP mapping; agentstart/config/agent-contract/MCP.md is normative. */
import { isAbsolute } from "node:path";
import * as z from "zod/v4";
import type { Parsed } from "./args.ts";
import {
  type Contract,
  type ContractArgument,
  type ContractCommand,
  constraintSentence,
} from "./contract.ts";
import { UsageError } from "./envelope.ts";

export interface AgentTool {
  name: string;
  path: string;
  title: string;
  description: string;
  input: z.ZodObject<Record<string, z.ZodType>>;
  arguments: ContractArgument[];
  annotations: {
    readOnlyHint: boolean;
    destructiveHint: boolean;
    idempotentHint: boolean;
    openWorldHint: boolean;
  };
}

const propertyName = (name: string): string => name.replace(/^--/, "");

function agentLeaves(
  commands: readonly ContractCommand[],
  prefix: string[] = [],
): Array<{ path: string[]; leaf: ContractCommand }> {
  return commands.flatMap((command) => {
    const path = [...prefix, command.name];
    if (command.subcommands !== undefined) return agentLeaves(command.subcommands, path);
    return command.audience === "agent" ? [{ path, leaf: command }] : [];
  });
}

function scalar(argument: ContractArgument): z.ZodType {
  if (argument.type === "boolean") return z.boolean();
  if (argument.choices) return z.enum(argument.choices as [string, ...string[]]);
  if (argument.type === "string") return z.string();
  let numeric = argument.type === "integer" ? z.number().int() : z.number();
  if (argument.minimum !== undefined) numeric = numeric.min(argument.minimum);
  if (argument.maximum !== undefined) numeric = numeric.max(argument.maximum);
  return numeric;
}

function property(argument: ContractArgument): z.ZodType {
  const descriptions = [argument.description];
  if (argument.csv) descriptions.push("Values are comma-joined into one string.");
  if (argument.format === "ref") {
    descriptions.push("A label or unambiguous phrase resolves; use an id only to disambiguate.");
  }
  if (argument.format === "path") {
    descriptions.push(
      argument.direction === "out"
        ? "The command WRITES and may overwrite this path. MCP requires an absolute destination; relative paths would use a working directory the caller did not choose."
        : "MCP requires an absolute file path. Standard input (-) is reserved for the protocol.",
    );
  }
  const base = argument.repeatable ? z.array(scalar(argument)) : scalar(argument);
  const described = base.describe(descriptions.join(" "));
  // Advertise defaults without materializing them. Presence itself matters for
  // --sound / --modality / --exotic conflicts; the handler applies defaults.
  const input = argument.required ? described : described.optional();
  return argument.default === undefined ? input : input.meta({ default: argument.default });
}

function constraints(leaf: ContractCommand): {
  keywords: Record<string, unknown>;
  descriptions: string[];
} {
  const keywords: Record<string, unknown> = {};
  const descriptions: string[] = [];
  for (const constraint of leaf.constraints ?? []) {
    descriptions.push(constraintSentence(constraint, propertyName));
    const members = constraint.arguments.map(propertyName);
    const alternatives = members.map((name) => {
      const argument = leaf.arguments?.find((candidate) => propertyName(candidate.name) === name);
      return {
        required: [name],
        ...(argument?.type === "boolean" ? { properties: { [name]: { const: true } } } : {}),
      };
    });
    if (constraint.kind === "one_of" && constraint.required) keywords.oneOf = alternatives;
    if (constraint.kind === "requires") {
      // Boolean flags mean "when true", not merely "when present".
      const source = leaf.arguments?.find((arg) => arg.name === constraint.arguments[0]);
      if (source?.type !== "boolean" && members[0] !== undefined) {
        keywords.dependentRequired = {
          ...(keywords.dependentRequired as Record<string, string[]> | undefined),
          [members[0]]: members.slice(1),
        };
      }
    }
  }
  return { keywords, descriptions };
}

export function agentTools(document: Contract): AgentTool[] {
  return agentLeaves(document.commands).map(({ path, leaf }) => {
    const args = [
      ...(leaf.arguments ?? []),
      ...document.global_arguments.filter((argument) => (argument.role ?? "call") === "call"),
    ];
    const shape: Record<string, z.ZodType> = {};
    for (const argument of args) shape[propertyName(argument.name)] = property(argument);
    const mapped = constraints(leaf);
    const description = [
      ...(leaf.blocking ? ["Blocks: this call can wait indefinitely; use a bounded wait."] : []),
      `${leaf.summary}.`,
      `Runs \`${document.meta.name} ${path.join(" ")}\` in this process.`,
      ...mapped.descriptions,
      ...(leaf.guidance ? [leaf.guidance] : []),
    ];
    return {
      name: path.join("_"),
      path: path.join(" "),
      title: leaf.summary,
      description: description.join("\n\n"),
      input: z.strictObject(shape).meta(mapped.keywords),
      arguments: args,
      annotations: {
        readOnlyHint: leaf.mutates === false,
        destructiveHint: leaf.mutates === true && args.some((arg) => arg.direction === "out"),
        // A draw is fresh and playback is audible on every invocation.
        idempotentHint: leaf.mutates === false,
        openWorldHint: false,
      },
    };
  });
}

export function serverInstructions(document: Contract): string {
  const envelope = Object.entries(document.concepts.output_contract.envelope)
    .map(([name, meaning]) => `  ${name}: ${meaning}`)
    .join("\n");
  const errors = document.concepts.error_codes
    .map(
      (error) =>
        `${error.code}: ${error.meaning}${error.recovery ? ` Recovery: ${error.recovery}` : ""}`,
    )
    .join("\n");
  return `${document.guidance}

Every tool preserves the CLI envelope in structuredContent and standalone JSON text:
${envelope}

Domain errors set isError=true. Their first text block gives the code, message,
and authored recovery. The separate JSON block preserves the same envelope.
Usage faults and unexpected failures without a domain code stay plain tool
errors. notify plays through the system audio device unless no-play=true.
Keep data.patch from print=true using native file tools, then replay its
absolute sound path. Input/output paths must be absolute. Cancelling or
closing the transport stops playback without deleting recipes or saved WAVs.

Error codes
${errors}

Opening moves
${(document.concepts.agent_defaults ?? []).join("\n")}
`;
}

/** Structured values go directly to shared handlers, without reparsing argv. */
export function invocationFor(tool: AgentTool, args: Record<string, unknown>): Parsed {
  const parsed: Parsed = { args: [], flags: {} };
  for (const argument of tool.arguments) {
    const value = args[propertyName(argument.name)];
    if (value === undefined) continue;
    if (argument.format === "path" && !isAbsolute(String(value))) {
      throw new UsageError(
        `${propertyName(argument.name)} requires an absolute file path; stdin is the MCP transport`,
      );
    }
    if (argument.positional) parsed.args.push(String(value));
    else if (argument.type === "boolean") {
      if (value === true) parsed.flags[propertyName(argument.name)] = true;
    } else parsed.flags[propertyName(argument.name)] = String(value);
  }
  return parsed;
}
