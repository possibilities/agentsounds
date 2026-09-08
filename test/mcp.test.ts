import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";
import { CONTRACT } from "../src/contract.ts";
import { parseSound } from "../src/sounds/audio/export/snippet.ts";

const MAIN = resolve(import.meta.dir, "../src/cli.ts");

interface RpcMessage {
  jsonrpc: string;
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: unknown;
}

/** A real stdio peer. Every stdout line must parse as JSON-RPC. */
class Wire {
  readonly child: ChildProcessWithoutNullStreams;
  readonly messages: RpcMessage[] = [];
  readonly exit: Promise<{ code: number | null; signal: string | null }>;
  readonly reading: Promise<void>;
  stderr = "";
  private nextId = 1;

  constructor(env: Record<string, string | undefined>, json = false) {
    this.child = spawn(process.execPath, [MAIN, "mcp", ...(json ? ["--json"] : [])], {
      stdio: ["pipe", "pipe", "pipe"],
      env,
    });
    this.exit = new Promise((resolveExit, reject) => {
      this.child.once("error", reject);
      this.child.once("exit", (code, signal) => resolveExit({ code, signal }));
    });
    this.child.stderr.on("data", (chunk) => {
      this.stderr += String(chunk);
    });
    const child = this.child;
    this.reading = (async () => {
      for await (const line of createInterface({ input: child.stdout })) {
        const message = JSON.parse(line) as RpcMessage;
        expect(message.jsonrpc).toBe("2.0");
        this.messages.push(message);
      }
    })();
  }

  send(value: unknown): void {
    this.child.stdin.write(`${JSON.stringify(value)}\n`);
  }

  start(method: string, params: unknown = {}): number {
    const id = this.nextId++;
    this.send({ jsonrpc: "2.0", id, method, params });
    return id;
  }

  async request<T>(method: string, params: unknown = {}): Promise<T> {
    const id = this.start(method, params);
    await until(() => this.messages.some((message) => message.id === id));
    const response = this.messages.find((message) => message.id === id);
    if (response?.error) throw new Error(JSON.stringify(response.error));
    return response?.result as T;
  }

  async initialize(): Promise<Record<string, unknown>> {
    const result = await this.request<Record<string, unknown>>("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "sounds-wire-test", version: "1" },
    });
    this.send({ jsonrpc: "2.0", method: "notifications/initialized" });
    return result;
  }

  call(name: string, args: Record<string, unknown> = {}): Promise<CallToolResult> {
    return this.request("tools/call", { name, arguments: args });
  }

  async stop(signal?: "SIGTERM"): Promise<void> {
    if (signal) this.child.kill(signal);
    else this.child.stdin.end();
    let forced = false;
    const timeout = setTimeout(() => {
      forced = true;
      this.child.kill("SIGKILL");
    }, 4000);
    try {
      expect(await this.exit).toEqual({ code: 0, signal: null });
      await this.reading;
      expect(forced).toBe(false);
      expect(this.stderr).toBe("");
    } finally {
      clearTimeout(timeout);
    }
  }

  async cleanup(): Promise<void> {
    if (this.child.exitCode === null && this.child.signalCode === null) this.child.kill("SIGKILL");
    await this.exit;
    await this.reading;
  }
}

async function until(condition: () => boolean): Promise<void> {
  const deadline = Date.now() + 5000;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error("Timed out waiting for the MCP peer");
    await Bun.sleep(10);
  }
}

function envelope<T = Record<string, unknown>>(
  result: CallToolResult,
): {
  schema_version: number;
  ok: boolean;
  error: { code: string; message: string } | null;
  data: T;
} {
  const structured = result.structuredContent;
  const block = result.content.find((entry) => entry.type === "text" && entry.text.startsWith("{"));
  if (block?.type !== "text") throw new Error("Missing standalone JSON envelope");
  expect(JSON.parse(block.text)).toEqual(structured);
  return structured as ReturnType<typeof envelope<T>>;
}

describe("Sounds producer MCP", () => {
  let directory: string;
  let env: Record<string, string | undefined>;
  const peers: Wire[] = [];
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "agentsounds-mcp-"));
    env = { ...process.env, AGENTSOUNDS_CACHE: join(directory, "cache") };
  });
  afterEach(async () => {
    for (const wire of peers.splice(0)) await wire.cleanup();
    rmSync(directory, { recursive: true, force: true });
  });
  async function peer(): Promise<Wire> {
    const wire = new Wire(env);
    peers.push(wire);
    await wire.initialize();
    return wire;
  }
  function player(): string {
    const bin = join(directory, "bin");
    mkdirSync(bin);
    const pid = join(directory, "player.pid");
    // The replacement child inherits ignored SIGTERM. The kill fallback must
    // still stop and reap it before the MCP parent reports shutdown complete.
    writeFileSync(
      join(bin, "afplay"),
      '#!/bin/sh\nprintf "%s" "$$" > "$AGENTSOUNDS_TEST_PLAYER_PID"\ntrap "" TERM\nexec /bin/sleep 30\n',
      { mode: 0o755 },
    );
    env = { ...env, PATH: bin, AGENTSOUNDS_TEST_PLAYER_PID: pid };
    return pid;
  }
  function alive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  test("advertises producer leaves, explicit flags, defaults, and the original guide", async () => {
    const wire = await peer();
    const { tools } = await wire.request<{ tools: Tool[] }>("tools/list");
    expect(tools.map((tool) => tool.name).sort()).toEqual(["guide", "notify"]);
    const notify = tools.find((tool) => tool.name === "notify");
    expect(notify?.inputSchema.properties?.modality).toMatchObject({ default: "familiar" });
    expect(notify?.inputSchema.oneOf).toEqual([
      { required: ["source"] },
      { required: ["sound"] },
      { required: ["list"], properties: { list: { const: true } } },
    ]);
    expect(notify?.inputSchema.properties).not.toHaveProperty("json");
    expect(notify?.inputSchema.additionalProperties).toBe(false);
    expect(notify?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false,
    });
    expect(envelope<typeof CONTRACT>(await wire.call("guide")).data).toEqual(CONTRACT);
    expect((await wire.call("tui")).isError).toBe(true);
    expect(envelope(await wire.call("notify", { list: true })).data.sources).toHaveLength(8);
    expect(existsSync(join(directory, "cache"))).toBe(false);
    await wire.stop();
  });

  test("keeps recipes, preserves explicit defaults, and renders a kept recipe", async () => {
    const wire = await peer();
    const created = await wire.call("notify", {
      source: "success",
      print: true,
      "no-play": true,
      list: false,
    });
    expect(created.isError).not.toBe(true);
    const kept = envelope(created).data.patch;
    expect(parseSound(JSON.stringify(kept)).ok).toBe(true);
    const recipe = join(directory, "kept.json");
    writeFileSync(recipe, JSON.stringify(kept));
    const saved = join(directory, "kept.wav");
    const replay = await wire.call("notify", {
      sound: recipe,
      save: saved,
      print: true,
      "no-play": true,
    });
    expect(replay.isError).not.toBe(true);
    expect(envelope(replay).data.patch).toEqual(kept);
    const wav = readFileSync(saved);
    expect(wav.subarray(0, 4).toString()).toBe("RIFF");
    expect(wav.subarray(8, 12).toString()).toBe("WAVE");
    expect(wav.byteLength).toBeGreaterThan(44);
    expect(
      (await wire.call("notify", { sound: recipe, modality: "familiar", "no-play": true })).isError,
    ).toBe(true);
    // Injecting a schema default would make this omitted modality conflict.
    expect(
      (await wire.call("notify", { source: "tap", exotic: true, "no-play": true })).isError,
    ).not.toBe(true);
    expect(
      (
        await wire.call("notify", {
          source: "tap",
          exotic: true,
          modality: "familiar",
          "no-play": true,
        })
      ).isError,
    ).toBe(true);
    await wire.stop();
  });

  test("preserves domain recovery and refuses invalid calls and ambiguous paths", async () => {
    env.PATH = join(directory, "no-players");
    const wire = await peer();
    const missing = await wire.call("notify", {
      sound: join(directory, "absent.json"),
      "no-play": true,
    });
    expect(missing.isError).toBe(true);
    expect(envelope(missing).error?.code).toBe("bad_recipe");
    expect(missing.content[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining("recovery:"),
    });
    expect(envelope(await wire.call("notify", { source: "tap" })).error?.code).toBe("no_player");
    for (const args of [
      {},
      { list: false },
      { source: "wrong" },
      { source: "tap", seed: 1 },
      { sound: "-" },
      { source: "tap", save: "relative.wav", "no-play": true },
    ]) {
      const result = await wire.call("notify", args);
      expect(result.isError).toBe(true);
      expect(result.structuredContent).toBeUndefined();
    }
    await wire.stop();
  });

  test("CLI retains recipe-only stdout, stdin replay, and JSON metadata", async () => {
    const first = Bun.spawn([process.execPath, MAIN, "notify", "success", "--print", "--no-play"], {
      env,
      stdout: "pipe",
      stderr: "pipe",
    });
    const recipe = await new Response(first.stdout).text();
    expect(await first.exited).toBe(0);
    expect(parseSound(recipe).ok).toBe(true);
    expect(JSON.parse(recipe)).not.toHaveProperty("schema_version");
    const second = Bun.spawn(
      [process.execPath, MAIN, "notify", "--sound", "-", "--print", "--json", "--no-play"],
      { env, stdin: "pipe", stdout: "pipe", stderr: "pipe" },
    );
    second.stdin.write(recipe);
    second.stdin.end();
    const result = JSON.parse(await new Response(second.stdout).text());
    expect(await second.exited).toBe(0);
    expect(result.ok).toBe(true);
    expect(result.data.patch).toEqual(JSON.parse(recipe));
  });

  test("cancellation stops and reaps playback while the MCP peer remains usable", async () => {
    const pidFile = player();
    const wire = await peer();
    const id = wire.start("tools/call", { name: "notify", arguments: { source: "tap" } });
    await until(() => existsSync(pidFile));
    const pid = Number(readFileSync(pidFile, "utf8"));
    wire.send({ jsonrpc: "2.0", method: "notifications/cancelled", params: { requestId: id } });
    await until(() => !alive(pid));
    expect(envelope(await wire.call("guide")).ok).toBe(true);
    expect(wire.messages.some((message) => message.id === id)).toBe(false);
    await wire.stop();
  });

  for (const mode of ["before-initialize", "idle", "playback", "SIGTERM"] as const) {
    test(`shuts down on ${mode} without an orphaned player or terminal envelope`, async () => {
      const pidFile = mode === "playback" || mode === "SIGTERM" ? player() : undefined;
      const wire = new Wire(env, mode === "idle");
      peers.push(wire);
      if (mode !== "before-initialize") await wire.initialize();
      if (pidFile) {
        wire.start("tools/call", { name: "notify", arguments: { source: "tap" } });
        await until(() => existsSync(pidFile));
      }
      await wire.stop(mode === "SIGTERM" ? "SIGTERM" : undefined);
      if (pidFile) expect(alive(Number(readFileSync(pidFile, "utf8")))).toBe(false);
      expect(wire.messages.every((message) => message.jsonrpc === "2.0")).toBe(true);
    }, 10000);
  }
});
