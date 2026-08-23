import { fg, bold as tuiBold } from "@opentui/core";

// The fx style guide (~/code/fxnk/style/STYLE.md, ground truth style/tokens.json).
//
// fx is monochrome: every semantic role collapses onto one grayscale ramp, and hierarchy
// comes from brightness and weight rather than hue. fx spends its single chromatic accent on
// diff markers; this app has no diffs, so it has no chroma at all. State is carried by glyph
// and weight, which is also what makes it read correctly with color disabled.
export interface Ramp {
  /** xterm 255/235 - what matters now, and keybinding hints. */
  primary: string;
  /** xterm 252/238 - labels, notice labels, semantic states. */
  accent: string;
  /** xterm 250/241 - notice body text. */
  secondary: string;
  /** xterm 245/247 - secondary chrome and detail text. */
  dim: string;
  /** xterm 240/250 - horizontal rules. Never carries words. */
  divider: string;
}

export const DARK: Ramp = {
  primary: "#eeeeee",
  accent: "#d0d0d0",
  secondary: "#bcbcbc",
  dim: "#8a8a8a",
  divider: "#585858",
};

export const LIGHT: Ramp = {
  primary: "#262626",
  accent: "#444444",
  secondary: "#626262",
  dim: "#9e9e9e",
  divider: "#bcbcbc",
};

export type ThemeName = "dark" | "light";

/**
 * fx's three ways to pick a palette, in its order: FX_THEME, then the terminal's own
 * background, then dark. The OSC 11 probe fx uses needs raw mode before the renderer owns
 * the tty, so COLORFGBG stands in for it here - the documented fallback of the same rule.
 */
export function detectTheme(env: NodeJS.ProcessEnv = process.env): ThemeName {
  const explicit = env["FX_THEME"];
  if (explicit === "light" || explicit === "dark") return explicit;

  // COLORFGBG is "fg;bg" in xterm color indices; a high background index is a light theme.
  const pair = env["COLORFGBG"];
  if (pair) {
    const background = Number(pair.split(";").pop());
    if (Number.isFinite(background)) return background >= 8 ? "light" : "dark";
  }
  return "dark";
}

export function ramp(name: ThemeName): Ramp {
  return name === "light" ? LIGHT : DARK;
}

export interface Ink {
  /** Brightest: the current sound, the selected row, keybinding hints. */
  hint: (s: string) => ReturnType<ReturnType<typeof fg>>;
  /** Bold labels and section titles. */
  label: (s: string) => ReturnType<typeof tuiBold>;
  /** Values and steady state. */
  value: (s: string) => ReturnType<ReturnType<typeof fg>>;
  /** Secondary metadata. */
  meta: (s: string) => ReturnType<ReturnType<typeof fg>>;
  /** Structure only - rules and rails. Never words. */
  rule: (s: string) => ReturnType<ReturnType<typeof fg>>;
}

export function ink(name: ThemeName): Ink {
  const r = ramp(name);
  return {
    hint: fg(r.primary),
    label: (s: string) => tuiBold(fg(r.primary)(s)),
    value: fg(r.accent),
    meta: fg(r.dim),
    rule: fg(r.divider),
  };
}

// The fx glyph vocabulary carries the state that color does not. No emoji: an fx house rule.
export const GLYPH = {
  rail: "┃",
  live: "●",
  idle: "○",
  branch: "├",
  last: "└",
  sep: "·",
  rule: "─",
  done: "✓",
  truncate: "…",
} as const;
