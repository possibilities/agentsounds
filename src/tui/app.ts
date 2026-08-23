import { homedir } from "node:os";
import { join } from "node:path";
import {
  BoxRenderable,
  type CliRenderer,
  createCliRenderer,
  type ParsedKey,
  StyledText,
  TextRenderable,
  t,
} from "@opentui/core";
import { draw, SOURCES, type Sound } from "../draw.ts";
import { play } from "../play.ts";
import { render } from "../render.ts";
import { bakeVolume } from "../sounds/audio/loudness.ts";
import { newMemory } from "../sounds/audio/prospect.ts";
import {
  current,
  initial,
  keyToAction,
  move,
  otherModality,
  remember,
  type State,
} from "./model.ts";
import { detectTheme, GLYPH, ink } from "./theme.ts";

const COLUMNS = 2;

type Chunks = StyledText["chunks"];

/** t`` refuses a StyledText operand, so composed lines are joined at the chunk level. */
function weave(...parts: StyledText[]): StyledText {
  const chunks: Chunks = [];
  for (const p of parts) chunks.push(...p.chunks);
  return new StyledText(chunks);
}

const NL = t`\n`;

/**
 * The product page as an fx-styled instrument: the eight source buttons, the Familiar/Exotic
 * toggle, the stage, and Recent Sounds. Monochrome throughout, per the fx guide - state is
 * carried by glyph and weight, so the screen reads correctly with color off.
 */
export async function start(): Promise<void> {
  const paint = ink(detectTheme());
  // Resolves only when the operator quits: the caller exits on that, so returning after
  // wiring the handlers would tear the screen down before a single key arrived.
  let done: () => void = () => {};
  const until = new Promise<void>((resolve) => {
    done = resolve;
  });
  const renderer: CliRenderer = await createCliRenderer({
    exitOnCtrlC: true,
    targetFps: 30,
    screenMode: "alternate-screen",
  });

  const root = new BoxRenderable(renderer, {
    id: "root",
    width: "100%",
    height: "100%",
    flexDirection: "column",
    paddingX: 2,
    paddingY: 1,
  });
  const body = new TextRenderable(renderer, {
    id: "body",
    content: "",
    wrapMode: "none",
    selectable: false,
    flexGrow: 1,
  });
  const hints = new TextRenderable(renderer, {
    id: "hints",
    content: "",
    wrapMode: "none",
    selectable: false,
    flexShrink: 0,
  });
  root.add(body);
  root.add(hints);
  renderer.root.add(root);

  let state: State = initial();
  const memory = newMemory();
  let playing = false;

  const rule = (label: string, width: number): StyledText => {
    const head = `${GLYPH.rule.repeat(2)} ${label} `;
    return t`${paint.rule(GLYPH.rule.repeat(2))} ${paint.label(label)} ${paint.rule(
      GLYPH.rule.repeat(Math.max(0, width - head.length)),
    )}`;
  };

  function sourceGrid(width: number): StyledText[] {
    const rows = Math.ceil(SOURCES.length / COLUMNS);
    const cell = Math.max(18, Math.floor((width - 4) / COLUMNS));
    const out: StyledText[] = [];
    for (let r = 0; r < rows; r++) {
      const parts: StyledText[] = [];
      for (let c = 0; c < COLUMNS; c++) {
        const i = c * rows + r;
        const source = SOURCES[i];
        if (!source) continue;
        const key = `[${i + 1}]`;
        const pad = " ".repeat(Math.max(1, cell - key.length - source.length - 3));
        parts.push(t`  ${paint.label(key)} ${paint.value(source)}${pad}`);
      }
      out.push(weave(...parts));
    }
    return out;
  }

  function stage(): StyledText {
    const sound = current(state);
    if (!sound) return t`  ${paint.meta("[ press 1-8 to draw a sound ]")}`;
    const mark = playing ? GLYPH.live : GLYPH.idle;
    return t`  ${paint.hint(GLYPH.rail)} ${paint.label("[ press ]")}  ${paint.meta(
      `${mark} ${sound.name}`,
    )}`;
  }

  function nowLine(): StyledText {
    const sound = current(state);
    if (!sound) return t`  ${paint.meta("nothing drawn yet")}`;
    const bits = [`${sound.seconds.toFixed(2)}s`, sound.freq, sound.modality ?? sound.source].join(
      ` ${GLYPH.sep} `,
    );
    return t`  ${paint.hint(sound.name)}  ${paint.meta(bits)}`;
  }

  function historyLines(): StyledText[] {
    if (state.history.length === 0) return [t`  ${paint.meta("no sounds yet")}`];
    return state.history.map((s, i) => {
      const last = i === state.history.length - 1;
      const connector = last ? GLYPH.last : GLYPH.branch;
      const name = i === state.selected ? paint.label(s.name) : paint.value(s.name);
      const rail = i === state.selected ? paint.hint(GLYPH.rail) : paint.meta(" ");
      const meta = `${s.seconds.toFixed(2)}s ${GLYPH.sep} ${s.freq}`;
      return t`${rail} ${paint.rule(connector)} ${name}  ${paint.meta(meta)}`;
    });
  }

  function repaint(): void {
    const width = renderer.terminalWidth - 4;
    const lines: StyledText[] = [
      rule("SOURCES", width),
      t``,
      ...sourceGrid(width),
      t``,
      rule(state.modality.toUpperCase(), width),
      t``,
      nowLine(),
      t``,
      stage(),
      t``,
      rule("RECENT", width),
      t``,
      ...historyLines(),
    ];
    if (state.notice) lines.push(t``, t`  ${paint.value(state.notice)}`);

    const woven: StyledText[] = [];
    lines.forEach((line, i) => {
      if (i > 0) woven.push(NL);
      woven.push(line);
    });
    body.content = weave(...woven);

    // fx keeps a keybinding hint row (its `hint` role names them); this is not the fleet's
    // chromeless shell, so the row belongs here.
    hints.content = t`${paint.meta(
      `1-8 draw ${GLYPH.sep} space replay ${GLYPH.sep} f ${state.modality === "familiar" ? "exotic" : "familiar"} ${GLYPH.sep} r reverse ${GLYPH.sep} s save ${GLYPH.sep} c copy ${GLYPH.sep} q quit`,
    )}`;
  }

  async function guarded(work: () => Promise<void>): Promise<void> {
    if (state.busy) return;
    state = { ...state, busy: true, notice: "" };
    repaint();
    try {
      await work();
    } catch (err) {
      state = { ...state, notice: err instanceof Error ? err.message : String(err) };
    } finally {
      state = { ...state, busy: false };
      repaint();
    }
  }

  async function sound(s: Sound, reverse = false): Promise<void> {
    playing = true;
    repaint();
    try {
      await play(s, { reverse });
    } finally {
      playing = false;
    }
  }

  const onKey = (key: ParsedKey) => {
    const action = keyToAction(key.name, key.sequence);
    switch (action.kind) {
      case "draw":
        void guarded(async () => {
          const s = await draw(action.source, {
            modality: state.modality,
            recent: state.history.slice(0, 6).map((h) => h.patch),
            memory,
          });
          state = remember(state, s);
          await sound(s);
        });
        return;
      case "modality":
        state = { ...state, modality: otherModality(state.modality) };
        repaint();
        return;
      case "press":
      case "reverse": {
        const s = current(state);
        if (s) void guarded(() => sound(s, action.kind === "reverse"));
        return;
      }
      case "up":
        state = move(state, -1);
        repaint();
        return;
      case "down":
        state = move(state, 1);
        repaint();
        return;
      case "save": {
        const s = current(state);
        if (!s) return;
        void guarded(async () => {
          const path = join(homedir(), `${s.name}.wav`);
          await Bun.write(path, await render(s));
          state = { ...state, notice: `${GLYPH.done} ${path}` };
        });
        return;
      }
      case "copy": {
        const s = current(state);
        if (!s) return;
        void guarded(async () => {
          const path = join(homedir(), `${s.name}.json`);
          await Bun.write(path, `${JSON.stringify(bakeVolume(s.patch, s.volume ?? 1), null, 2)}\n`);
          state = { ...state, notice: `${GLYPH.done} ${path}` };
        });
        return;
      }
      case "quit":
        renderer.keyInput.off("keypress", onKey);
        renderer.destroy();
        done();
        return;
      default:
        return;
    }
  };

  renderer.keyInput.on("keypress", onKey);
  renderer.on("resize", repaint);
  repaint();
  await until;
}
