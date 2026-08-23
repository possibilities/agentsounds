import { describe, expect, test } from "bun:test";
import { draw, freqLabel, isModality, isSource, pool, SOURCES } from "../src/index.ts";
import { render } from "../src/render.ts";
import { parseSound } from "../src/sounds/audio/export/snippet.ts";
import { bakeVolume } from "../src/sounds/audio/loudness.ts";
import { patchTag } from "../src/sounds/audio/naming.ts";
import type { Patch } from "../src/sounds/audio/patch.ts";
import deleted from "../src/sounds/data/deleted.json";

describe("the curated library", () => {
  test("builds from the vendored snapshot, not empty defaults", () => {
    const p = pool();
    expect(p.all.length).toBeGreaterThan(400);
    for (const category of ["tap", "hover", "success", "error"] as const) {
      expect(p.byCategory.get(category)!.length).toBeGreaterThan(0);
    }
  });

  test("a deleted sound never reaches a pool", () => {
    const ids = new Set(pool().all.map((s) => s.id));
    for (const id of deleted as string[]) expect(ids.has(id)).toBe(false);
  });
});

describe("sources", () => {
  test("are the product's eight buttons, in order", () => {
    expect([...SOURCES]).toEqual([
      "tap",
      "hover",
      "transition",
      "success",
      "error",
      "warning",
      "notification",
      "experimental",
    ]);
  });

  test("validate", () => {
    expect(isSource("tap")).toBe(true);
    expect(isSource("misc")).toBe(false);
    expect(isModality("exotic")).toBe(true);
    expect(isModality("nebula")).toBe(false);
  });
});

describe("draw", () => {
  for (const source of SOURCES) {
    test(`${source} produces a playable, leveled sound`, async () => {
      const s = await draw(source);
      expect(s.name.startsWith(source)).toBe(true);
      expect(s.seconds).toBeGreaterThan(0);
      expect(s.patch).toBeDefined();
      expect(s.volume).toBeGreaterThan(0);
    });
  }

  test("experimental answers to no category", async () => {
    const s = await draw("experimental");
    expect(s.category).toBeNull();
    expect(s.modality).toBeNull();
  });

  test("exotic rebuilds inside the drawn category", async () => {
    const s = await draw("success", { modality: "exotic" });
    expect(s.modality).toBe("exotic");
    expect(s.category).toBe("success");
  });
});

describe("naming", () => {
  test("is derived from the recipe, so a repeat names alike", async () => {
    const s = await draw("tap");
    expect(s.name).toBe(`tap-${patchTag(s.patch)}`);
    expect(patchTag(s.patch)).toBe(patchTag(structuredClone(s.patch)));
  });
});

describe("render", () => {
  test("emits a mono 16-bit RIFF with audible content", async () => {
    const s = await draw("success");
    const wav = await render(s);
    expect(new TextDecoder().decode(wav.slice(0, 4))).toBe("RIFF");
    expect(new TextDecoder().decode(wav.slice(8, 12))).toBe("WAVE");
    const view = new DataView(wav.buffer as ArrayBuffer, wav.byteOffset + 44);
    let peak = 0;
    for (let i = 0; i < (wav.length - 44) / 2; i++) {
      peak = Math.max(peak, Math.abs(view.getInt16(i * 2, true)) / 32768);
    }
    expect(peak).toBeGreaterThan(0.01);
  });

  test("reverse is a different render of the same recipe", async () => {
    const s = await draw("transition");
    const forward = await render(s);
    const back = await render(s, { reverse: true });
    expect(back.length).toBeGreaterThan(44);
    expect(Buffer.from(forward).equals(Buffer.from(back))).toBe(false);
  });
});

describe("the kept-recipe round trip", () => {
  test("a kept recipe carries its level and parses back", async () => {
    const s = await draw("notification");
    const kept = bakeVolume(s.patch, s.volume ?? 1);
    const back = parseSound(JSON.stringify(kept, null, 2));
    expect(back.ok).toBe(true);
    if (back.ok) expect(patchTag(back.patch)).toBe(patchTag(kept));
  });

  test("reads the product's copied-sound format, not only bare JSON", async () => {
    const s = await draw("tap");
    const pasted = `const readyRemix = ${JSON.stringify(s.patch)};playSound(readyRemix);`;
    expect(parseSound(pasted).ok).toBe(true);
  });

  test("rejects a paste that is not a recipe", () => {
    expect(parseSound("not a sound").ok).toBe(false);
  });
});

describe("freqLabel", () => {
  test("names a glide with both ends", () => {
    const glide = {
      layers: [
        {
          source: { type: "sine", frequency: { start: 838, end: 559 } },
          envelope: { attack: 0.01, decay: 0.1 },
          gain: 0.5,
        },
      ],
    } as unknown as Patch;
    expect(freqLabel(glide)).toContain("838");
    expect(freqLabel(glide)).toContain("559");
  });
});
