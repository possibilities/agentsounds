import { argumentsOf, type ContractArgument, type ContractCommand, flagKey } from "./contract.ts";
import { UsageError } from "./envelope.ts";

export interface Parsed {
  args: string[];
  flags: Record<string, string | boolean>;
}

function choicesHint(a: ContractArgument): string {
  return a.choices ? `\n\nOne of: ${a.choices.join(", ")}` : "";
}

/**
 * Strict argv parsing against the command's contract entry. Anything unrecognized is a
 * usage fault, and the contract's `constraints` are enforced here — a relation declared
 * to a caller and not checked at the door is a lie.
 */
export function parse(c: ContractCommand, argv: readonly string[]): Parsed {
  const accepted = argumentsOf(c);
  const args: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!;
    if (!token.startsWith("--")) {
      args.push(token);
      continue;
    }
    const eq = token.indexOf("=");
    const name = eq === -1 ? token : token.slice(0, eq);
    const inline = eq === -1 ? undefined : token.slice(eq + 1);
    const desc = accepted.find((a) => !a.positional && a.name === name);
    if (!desc) throw new UsageError(`unknown flag ${name}`);

    if (desc.type === "boolean") {
      if (inline !== undefined) throw new UsageError(`${name} takes no value`);
      flags[flagKey(name)] = true;
      continue;
    }
    const value = inline ?? argv[++i];
    if (value === undefined) throw new UsageError(`${name} needs a value`);
    if (desc.choices && !desc.choices.includes(value)) {
      throw new UsageError(`${name} must be one of: ${desc.choices.join(", ")}`);
    }
    flags[flagKey(name)] = value;
  }

  const parsed = { args, flags };
  validateParsed(c, parsed);
  return parsed;
}

/** The same contract checks apply to structured MCP input without argv. */
export function validateParsed(c: ContractCommand, parsed: Parsed): void {
  const accepted = argumentsOf(c);
  const positionals = accepted.filter((a) => a.positional);
  const { args, flags } = parsed;
  // Positionals are validated after flags so a bad value reports the allowed set, and a
  // missing required one reports it too: calling `notify` bare must say what the sources are.
  positionals.forEach((spec, i) => {
    const value = args[i];
    if (value === undefined) {
      if (spec.required) throw new UsageError(`${c.name} needs a ${spec.name}${choicesHint(spec)}`);
      return;
    }
    if (spec.choices && !spec.choices.includes(value)) {
      throw new UsageError(`unknown ${spec.name} "${value}"${choicesHint(spec)}`);
    }
  });
  if (args.length > positionals.length) {
    throw new UsageError(`unexpected argument "${args[positionals.length]}"`);
  }

  const given = (name: string): boolean => {
    const spec = accepted.find((a) => a.name === name);
    if (spec?.positional) return args[positionals.indexOf(spec)] !== undefined;
    return flagKey(name) in flags;
  };

  for (const k of c.constraints ?? []) {
    const present = k.arguments.filter(given);
    if (k.kind === "one_of") {
      if (present.length > 1) {
        throw new UsageError(`${present.join(" and ")} cannot be combined`);
      }
      if (present.length === 0 && k.required) {
        const hint = k.arguments
          .map((n) => accepted.find((a) => a.name === n))
          .find((a) => a?.choices);
        throw new UsageError(
          `${k.description ?? `${c.name} needs one of: ${k.arguments.join(", ")}`}${
            hint ? choicesHint(hint) : ""
          }`,
        );
      }
    } else if (k.kind === "conflicts") {
      if (present.length > 1) {
        const why = k.description ? `: ${k.description}` : "";
        throw new UsageError(`${present.join(" and ")} cannot be combined${why}`);
      }
    } else if (present.includes(k.arguments[0]!)) {
      const missing = k.arguments.slice(1).filter((n) => !given(n));
      if (missing.length > 0) {
        throw new UsageError(`${k.arguments[0]} requires ${missing.join(", ")}`);
      }
    }
  }
}
