import { describe, expect, test } from "bun:test";
import { parse } from "../src/args.ts";
import { findCommand, helpJson, topHelp } from "../src/descriptor.ts";
import { UsageError } from "../src/envelope.ts";

const notify = findCommand("notify")!;

describe("argv", () => {
  test("takes a source and a modality", () => {
    const p = parse(notify, ["success", "--exotic"]);
    expect(p.args[0]).toBe("success");
    expect(p.flags["exotic"]).toBe(true);
  });

  test("takes --flag=value and --flag value alike", () => {
    expect(parse(notify, ["tap", "--save=a.wav"]).flags["save"]).toBe("a.wav");
    expect(parse(notify, ["tap", "--save", "a.wav"]).flags["save"]).toBe("a.wav");
  });

  test("a bare notify names the sources it wanted", () => {
    expect(() => parse(notify, [])).toThrow(/needs a source/);
    try {
      parse(notify, []);
    } catch (e) {
      expect((e as Error).message).toContain("experimental");
    }
  });

  test("an unknown source is a usage fault naming the real ones", () => {
    expect(() => parse(notify, ["misc"])).toThrow(UsageError);
    expect(() => parse(notify, ["misc"])).toThrow(/notification/);
  });

  test("an unknown flag is a usage fault", () => {
    expect(() => parse(notify, ["tap", "--vibe"])).toThrow(/unknown flag/);
  });

  test("a value flag without a value is a usage fault", () => {
    expect(() => parse(notify, ["tap", "--save"])).toThrow(/needs a value/);
  });

  test("a boolean flag refuses a value", () => {
    expect(() => parse(notify, ["tap", "--exotic=yes"])).toThrow(/takes no value/);
  });

  test("a constrained flag rejects an unlisted value", () => {
    expect(() => parse(notify, ["tap", "--modality", "nebula"])).toThrow(/must be one of/);
  });

  test("an extra positional is a usage fault", () => {
    expect(() => parse(notify, ["tap", "hover"])).toThrow(/unexpected argument/);
  });

  test("--sound relaxes the required source", () => {
    expect(() => parse(notify, ["--sound", "a.json"], false)).not.toThrow();
  });
});

describe("the descriptor drives help", () => {
  test("top help lists every command", () => {
    for (const name of ["notify", "tui"]) expect(topHelp()).toContain(name);
  });

  test("help-json carries the same commands and flags", () => {
    const json = helpJson() as { commands: { name: string; flags: { name: string }[] }[] };
    const n = json.commands.find((c) => c.name === "notify")!;
    const flags = n.flags.map((f) => f.name);
    for (const flag of ["exotic", "save", "print", "sound", "reverse"]) {
      expect(flags).toContain(flag);
    }
  });
});
