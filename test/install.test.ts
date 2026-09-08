import { afterEach, expect, test } from "bun:test";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function command(cwd: string, argv: string[], env = process.env) {
  const result = Bun.spawnSync(argv, { cwd, env, stdout: "pipe", stderr: "pipe" });
  return {
    code: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

function fixture() {
  const base = realpathSync(mkdtempSync(join(tmpdir(), "agentsounds-install-")));
  roots.push(base);
  chmodSync(base, 0o700);
  const repo = join(base, "repo");
  const bin = join(base, "bin");
  const state = join(base, "state");
  mkdirSync(join(repo, "scripts"), { recursive: true });
  mkdirSync(join(repo, "src"));
  writeFileSync(
    join(repo, "scripts/install.sh"),
    readFileSync(join(import.meta.dir, "../scripts/install.sh")),
    { mode: 0o755 },
  );
  writeFileSync(join(repo, "src/cli.ts"), '#!/usr/bin/env bun\nconsole.log("fixture");\n', {
    mode: 0o755,
  });
  writeFileSync(join(repo, "package.json"), '{"name":"agentsounds","type":"module"}\n');
  writeFileSync(join(repo, ".gitignore"), "node_modules\n");
  expect(command(repo, [process.execPath, "install"]).code).toBe(0);
  for (const argv of [
    ["git", "init", "-q"],
    ["git", "remote", "add", "origin", "https://github.com/possibilities/agentsounds.git"],
    ["git", "add", "."],
    [
      "git",
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "commit",
      "-qm",
      "Fixture",
    ],
  ])
    expect(command(repo, argv).code).toBe(0);
  const sha = command(repo, ["git", "rev-parse", "HEAD"]).stdout.trim();
  const env = {
    ...process.env,
    AGENTSOUNDS_INSTALL_BIN_DIR: bin,
    AGENTSOUNDS_INSTALL_STATE_DIR: state,
  };
  return {
    base,
    repo,
    bin,
    state,
    sha,
    target: join(bin, "agentsounds"),
    receipt: join(state, "deployed-sha"),
    run: (...args: string[]) => command(repo, ["bash", "scripts/install.sh", ...args], env),
  };
}

test("check is read-only; installation converges the exact source and private receipt", () => {
  const f = fixture();
  expect(f.run("--check").code).toBe(0);
  expect(existsSync(f.bin)).toBe(false);
  expect(f.run("--install").code).toBe(0);
  expect(readlinkSync(f.target)).toBe(join(f.repo, "src/cli.ts"));
  expect(readFileSync(f.receipt, "utf8")).toBe(`${f.sha}\n`);
  expect(statSync(f.receipt).mode & 0o777).toBe(0o600);
  expect(f.run("--install").code).toBe(0);
});

test("refuses independent commands, uncorroborated receipts, and dirty source", () => {
  const foreign = fixture();
  mkdirSync(foreign.bin);
  writeFileSync(foreign.target, "independent\n");
  expect(foreign.run("--install").stderr).toContain("refusing foreign command path");
  expect(readFileSync(foreign.target, "utf8")).toBe("independent\n");
  const uncorroborated = fixture();
  mkdirSync(uncorroborated.state, { mode: 0o700 });
  writeFileSync(uncorroborated.receipt, `${uncorroborated.sha}\n`, { mode: 0o600 });
  expect(uncorroborated.run("--install").stderr).toContain("uncorroborated deployed receipt");
  const dirty = fixture();
  writeFileSync(join(dirty.repo, "untracked.txt"), "unfinished\n");
  expect(dirty.run("--install").stderr).toContain("dirty source checkout");
  expect(existsSync(dirty.target)).toBe(false);
});

test("refuses a symlinked installation directory", () => {
  const f = fixture();
  const other = join(f.base, "other");
  mkdirSync(other);
  symlinkSync(other, f.bin);
  expect(f.run("--install").stderr).toContain("symlinked bin path component");
  expect(existsSync(join(other, "agentsounds"))).toBe(false);
});

test("uninstall preserves recipes, cached WAVs, and pre-existing Bun links", () => {
  const f = fixture();
  const recipe = join(f.base, "kept.json");
  const wav = join(f.base, "cached.wav");
  const legacy = join(f.base, "bun-link");
  writeFileSync(recipe, "recipe\n");
  writeFileSync(wav, "wav\n");
  symlinkSync(join(f.repo, "src/cli.ts"), legacy);
  expect(f.run("--install").code).toBe(0);
  expect(f.run("--uninstall").code).toBe(0);
  expect(existsSync(f.target)).toBe(false);
  expect(existsSync(f.receipt)).toBe(false);
  expect(readFileSync(recipe, "utf8")).toBe("recipe\n");
  expect(readFileSync(wav, "utf8")).toBe("wav\n");
  expect(readlinkSync(legacy)).toBe(join(f.repo, "src/cli.ts"));
});
