import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
const stubBin = fileURLToPath(new URL("./stub", import.meta.url));

const appSource = "const a = 1;\nsetTimeout(run, 86400000);\n// TODO: later\n";

async function project(config: unknown = [{ extends: ["./rules"], rules: { "no-todo": "warn" } }]) {
  const dir = await mkdtemp(join(tmpdir(), "pluis-cli-"));
  await mkdir(join(dir, "rules"));
  await writeFile(join(dir, "rules", "no-magic-numbers.md"), "# No magic numbers\n");
  await writeFile(join(dir, "rules", "no-todo.md"), "# No TODO\n");
  await writeFile(join(dir, "app.ts"), appSource);
  await writeFile(join(dir, "pluis.json"), JSON.stringify(config));
  return dir;
}

const magic = { rule: "no-magic-numbers", path: "app.ts", line: 2, quote: "86400000", message: "Name the number." };
const todo = { rule: "no-todo", path: "app.ts", line: 3, quote: "TODO", message: "Resolve it." };

function pluis(dir: string, args: string[], stub: object[], log?: string) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: dir,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: stubBin + delimiter + process.env.PATH,
      PLUIS_STUB: JSON.stringify(stub),
      PLUIS_STUB_LOG: log ?? "",
    },
  });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

test("prints one line per finding and exits 1 on an error", async () => {
  const dir = await project();

  const result = pluis(dir, ["app.ts"], [magic, todo]);

  assert.equal(result.stdout, "app.ts:2 error no-magic-numbers Name the number.\napp.ts:3 warn no-todo Resolve it.\n");
  assert.equal(result.code, 1);
});

test("exits 0 when only warn and info findings remain", async () => {
  const dir = await project([{ extends: ["./rules"], rules: { "no-magic-numbers": "info", "no-todo": "warn" } }]);

  const result = pluis(dir, ["app.ts"], [magic, todo]);

  assert.equal(result.stdout, "app.ts:2 info no-magic-numbers Name the number.\napp.ts:3 warn no-todo Resolve it.\n");
  assert.equal(result.code, 0);
});

test("drops a finding whose quote is not on its line", async () => {
  const dir = await project();

  const result = pluis(dir, ["app.ts"], [{ ...magic, line: 1 }]);

  assert.equal(result.stdout, "");
  assert.equal(result.code, 0);
});

test("--format json prints findings as a JSON array", async () => {
  const dir = await project();

  const result = pluis(dir, ["--format", "json", "app.ts"], [magic]);

  assert.deepEqual(JSON.parse(result.stdout), [
    { path: "app.ts", line: 2, severity: "error", rule: "no-magic-numbers", message: "Name the number.", quote: "86400000" },
  ]);
});

test("asks claude per enabled rule with the configured model and no tools", async () => {
  const dir = await project([{ extends: ["./rules"], rules: { "no-todo": "off" }, model: "sonnet" }]);
  const log = join(dir, "calls.log");

  pluis(dir, ["app.ts"], [], log);

  const calls = (await readFile(log, "utf8")).trim().split("\n").map((line) => JSON.parse(line));
  assert.deepEqual(calls.map((call) => call.rule), ["no-magic-numbers"]);
  const args: string[] = calls[0].args;
  assert.equal(args[args.indexOf("--model") + 1], "sonnet");
  assert.ok(args.includes("-p"));
  assert.equal(args[args.indexOf("--tools") + 1], "");
});

test("--diff keeps only findings on lines changed since the base", async () => {
  const dir = await project();
  const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, stdio: "pipe" });
  git("init", "-q");
  git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "base");
  git("add", ".");
  git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "app");
  await writeFile(join(dir, "app.ts"), appSource.replace("TODO: later", "TODO: now"));

  const result = pluis(dir, ["--diff", "HEAD", "app.ts"], [magic, todo]);

  assert.equal(result.stdout, "app.ts:3 warn no-todo Resolve it.\n");
  assert.equal(result.code, 0);
});

test("--diff ignores lines the base branch changed after the fork", async () => {
  const dir = await project();
  const git = (...args: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd: dir, stdio: "pipe" });
  git("init", "-q", "-b", "main");
  git("add", ".");
  git("commit", "-q", "-m", "app");
  git("switch", "-q", "-c", "feature");
  git("switch", "-q", "main");
  await writeFile(join(dir, "app.ts"), appSource.replace("86400000", "3600000"));
  git("commit", "-q", "-am", "main moves");
  git("switch", "-q", "feature");
  await writeFile(join(dir, "app.ts"), appSource.replace("TODO: later", "TODO: now"));

  const result = pluis(dir, ["--diff", "main", "app.ts"], [magic, todo]);

  assert.equal(result.stdout, "app.ts:3 warn no-todo Resolve it.\n");
});

test("--diff treats an untracked file as wholly changed", async () => {
  const dir = await project();
  execFileSync("git", ["init", "-q"], { cwd: dir });

  const result = pluis(dir, ["--diff", "HEAD", "app.ts"], [magic]);

  assert.equal(result.stdout, "app.ts:2 error no-magic-numbers Name the number.\n");
});

test("exits 2 with usage when no files are given", async () => {
  const dir = await project();

  const result = pluis(dir, [], []);

  assert.equal(result.code, 2);
  assert.match(result.stderr, /Usage: pluis/);
});
