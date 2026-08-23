import { describe, expect, test } from "bun:test";
import type { Sound } from "../src/draw.ts";
import { SOURCES } from "../src/draw.ts";
import { current, initial, keyToAction, move, otherModality, remember } from "../src/tui/model.ts";
import { detectTheme, GLYPH, ink, ramp } from "../src/tui/theme.ts";

const sound = (name: string) =>
  ({
    name,
    source: "tap",
    category: "tap",
    modality: "familiar",
    patch: { layers: [] },
    volume: 1,
    seconds: 0.2,
    freq: "440 Hz",
  }) as unknown as Sound;

describe("keys", () => {
  test("1-8 are the eight source buttons in on-screen order", () => {
    SOURCES.forEach((source, i) => {
      expect(keyToAction(String(i + 1))).toEqual({ kind: "draw", source });
    });
  });

  test("9 is not a source", () => {
    expect(keyToAction("9")).toEqual({ kind: "none" });
  });

  test("space and enter press the stage", () => {
    expect(keyToAction("space").kind).toBe("press");
    expect(keyToAction("return").kind).toBe("press");
  });

  test("f flips the modality", () => {
    expect(keyToAction("f").kind).toBe("modality");
    expect(otherModality("familiar")).toBe("exotic");
    expect(otherModality("exotic")).toBe("familiar");
  });

  test("j/k and the arrows both move the selection", () => {
    expect(keyToAction("j").kind).toBe("down");
    expect(keyToAction("down").kind).toBe("down");
    expect(keyToAction("k").kind).toBe("up");
    expect(keyToAction("up").kind).toBe("up");
  });

  test("an unbound key does nothing", () => {
    expect(keyToAction("z").kind).toBe("none");
    expect(keyToAction("").kind).toBe("none");
  });
});

describe("history", () => {
  test("newest first, and a draw selects it", () => {
    let s = initial();
    s = remember(s, sound("a"));
    s = remember(s, sound("b"));
    expect(s.history[0]!.name).toBe("b");
    expect(current(s)!.name).toBe("b");
  });

  test("is bounded", () => {
    let s = initial();
    for (let i = 0; i < 20; i++) s = remember(s, sound(`s${i}`));
    expect(s.history.length).toBe(8);
  });

  test("selection clamps at both ends", () => {
    let s = remember(remember(initial(), sound("a")), sound("b"));
    expect(move(s, -1).selected).toBe(0);
    s = move(s, 1);
    expect(s.selected).toBe(1);
    expect(move(s, 1).selected).toBe(1);
  });

  test("moving on an empty history is a no-op", () => {
    expect(move(initial(), 1).selected).toBe(0);
    expect(current(initial())).toBeUndefined();
  });
});

describe("fx style", () => {
  test("is monochrome: every ramp value is a pure gray", () => {
    for (const theme of ["dark", "light"] as const) {
      for (const hex of Object.values(ramp(theme))) {
        const [r, g, b] = [1, 3, 5].map((i) => hex.slice(i, i + 2));
        expect(r).toBe(g!);
        expect(g).toBe(b!);
      }
    }
  });

  test("dark and light are the guide's five steps", () => {
    expect(ramp("dark")).toEqual({
      primary: "#eeeeee",
      accent: "#d0d0d0",
      secondary: "#bcbcbc",
      dim: "#8a8a8a",
      divider: "#585858",
    });
    expect(ramp("light")).toEqual({
      primary: "#262626",
      accent: "#444444",
      secondary: "#626262",
      dim: "#9e9e9e",
      divider: "#bcbcbc",
    });
  });

  test("FX_THEME wins, then the terminal background, then dark", () => {
    expect(detectTheme({ FX_THEME: "light" } as NodeJS.ProcessEnv)).toBe("light");
    expect(detectTheme({ FX_THEME: "dark", COLORFGBG: "0;15" } as NodeJS.ProcessEnv)).toBe("dark");
    expect(detectTheme({ COLORFGBG: "0;15" } as NodeJS.ProcessEnv)).toBe("light");
    expect(detectTheme({ COLORFGBG: "15;0" } as NodeJS.ProcessEnv)).toBe("dark");
    expect(detectTheme({} as NodeJS.ProcessEnv)).toBe("dark");
  });

  test("carries no emoji", () => {
    for (const g of Object.values(GLYPH)) {
      expect(/\p{Extended_Pictographic}/u.test(g)).toBe(false);
    }
  });

  test("ink exposes every role", () => {
    const i = ink("dark");
    for (const role of ["hint", "label", "value", "meta", "rule"] as const) {
      expect(typeof i[role]).toBe("function");
    }
  });
});
