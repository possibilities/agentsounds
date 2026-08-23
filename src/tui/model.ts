import type { Modality, Sound, Source } from "../draw.ts";
import { SOURCES } from "../draw.ts";

export const HISTORY_LIMIT = 8;

export type Action =
  | { kind: "draw"; source: Source }
  | { kind: "modality" }
  | { kind: "press" }
  | { kind: "reverse" }
  | { kind: "save" }
  | { kind: "copy" }
  | { kind: "up" }
  | { kind: "down" }
  | { kind: "quit" }
  | { kind: "none" };

export interface State {
  modality: Modality;
  /** Newest first. The product's Recent Sounds, session-scoped exactly as there. */
  history: Sound[];
  /** Index into history; 0 is the current sound and what the stage button presses. */
  selected: number;
  busy: boolean;
  notice: string;
}

export function initial(): State {
  return { modality: "familiar", history: [], selected: 0, busy: false, notice: "" };
}

export function current(state: State): Sound | undefined {
  return state.history[state.selected];
}

/**
 * Keys to actions, kept pure so the mapping is testable without a renderer.
 *
 * Digits 1-8 are the product's eight source buttons in their on-screen order. ctrl+c is never
 * consumed here: the app leaves it to the terminal.
 */
export function keyToAction(name: string, sequence?: string): Action {
  const digit = Number(name);
  if (Number.isInteger(digit) && digit >= 1 && digit <= SOURCES.length) {
    return { kind: "draw", source: SOURCES[digit - 1]! };
  }
  switch (name) {
    case "f":
      return { kind: "modality" };
    case "space":
    case "return":
      return { kind: "press" };
    case "r":
      return { kind: "reverse" };
    case "s":
      return { kind: "save" };
    case "c":
      return { kind: "copy" };
    case "up":
    case "k":
      return { kind: "up" };
    case "down":
    case "j":
      return { kind: "down" };
    case "q":
    case "escape":
      return { kind: "quit" };
    default:
      return sequence === " " ? { kind: "press" } : { kind: "none" };
  }
}

export function remember(state: State, sound: Sound): State {
  return {
    ...state,
    history: [sound, ...state.history].slice(0, HISTORY_LIMIT),
    selected: 0,
  };
}

export function move(state: State, delta: number): State {
  if (state.history.length === 0) return state;
  const next = Math.min(state.history.length - 1, Math.max(0, state.selected + delta));
  return { ...state, selected: next };
}

export function otherModality(m: Modality): Modality {
  return m === "familiar" ? "exotic" : "familiar";
}
