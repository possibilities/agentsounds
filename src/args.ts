import type { CommandDescriptor, FlagDescriptor } from "./descriptor.ts";
import { UsageError } from "./envelope.ts";

export interface Parsed {
  args: string[];
  flags: Record<string, string | boolean>;
}

function findFlag(c: CommandDescriptor, name: string): FlagDescriptor | undefined {
  return c.flags.find((f) => f.name === name);
}

/** Strict argv parsing against a command descriptor. Anything unrecognized is a usage fault. */
export function parse(c: CommandDescriptor, argv: readonly string[], requireArgs = true): Parsed {
  const args: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!;
    if (!token.startsWith("--")) {
      args.push(token);
      continue;
    }
    const eq = token.indexOf("=");
    const name = eq === -1 ? token.slice(2) : token.slice(2, eq);
    const inline = eq === -1 ? undefined : token.slice(eq + 1);
    const desc = findFlag(c, name);
    if (!desc) throw new UsageError(`unknown flag --${name}`);

    if (desc.type === "boolean") {
      if (inline !== undefined) throw new UsageError(`--${name} takes no value`);
      flags[name] = true;
      continue;
    }
    const value = inline ?? argv[++i];
    if (value === undefined) throw new UsageError(`--${name} needs a value`);
    if (desc.allowed && !desc.allowed.includes(value)) {
      throw new UsageError(`--${name} must be one of: ${desc.allowed.join(", ")}`);
    }
    flags[name] = value;
  }

  // Positionals are validated after flags so a bad value reports the allowed set, and a
  // missing required one reports it too: calling `notify` bare must say what the sources are.
  c.args.forEach((spec, i) => {
    const value = args[i];
    if (value === undefined) {
      if (spec.required && requireArgs) {
        const allowed = spec.allowed ? `\n\nOne of: ${spec.allowed.join(", ")}` : "";
        throw new UsageError(`${c.name} needs a ${spec.name}${allowed}`);
      }
      return;
    }
    if (spec.allowed && !spec.allowed.includes(value)) {
      throw new UsageError(`unknown ${spec.name} "${value}"\n\nOne of: ${spec.allowed.join(", ")}`);
    }
  });
  if (args.length > c.args.length) {
    throw new UsageError(`unexpected argument "${args[c.args.length]}"`);
  }

  return { args, flags };
}
