import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { loadConfig, settingsFor } from "../src/config.ts";

async function project(config: unknown) {
  const dir = await mkdtemp(join(tmpdir(), "pluis-config-"));
  await mkdir(join(dir, "rules"));
  await writeFile(join(dir, "rules", "no-todo.md"), "# No TODO\n");
  await writeFile(join(dir, "rules", "short-functions.md"), "---\nlanguages: [typescript]\n---\n# Short\n");
  await writeFile(join(dir, "pluis.json"), JSON.stringify(config));
  return dir;
}

function enabled(settings: ReturnType<typeof settingsFor>) {
  return Object.fromEntries(settings.rules.map(({ rule, severity }) => [rule.id, severity]));
}

test("extends turns a rule directory on at error, later entries override per file", async () => {
  const dir = await project([
    { extends: ["./rules"] },
    { files: ["legacy/**"], rules: { "no-todo": "warn", "short-functions": "off" } },
  ]);
  const config = await loadConfig(dir);

  assert.deepEqual(enabled(settingsFor(config, "src/a.ts")), { "no-todo": "error", "short-functions": "error" });
  assert.deepEqual(enabled(settingsFor(config, "legacy/a.ts")), { "no-todo": "warn" });
});

test("settingsFor drops rules whose languages do not match the file", async () => {
  const config = await loadConfig(await project([{ extends: ["./rules"] }]));

  assert.deepEqual(enabled(settingsFor(config, "main.py")), { "no-todo": "error" });
});

test("model defaults to haiku and the last matching entry sets it", async () => {
  const config = await loadConfig(await project([
    { extends: ["./rules"], model: "sonnet" },
    { files: ["cheap/**"], model: "haiku" },
  ]));

  assert.equal(settingsFor(config, "src/a.ts").model, "sonnet");
  assert.equal(settingsFor(config, "cheap/a.ts").model, "haiku");
  assert.equal(settingsFor(await loadConfig(await project([])), "a.ts").model, "haiku");
});

test("extends resolves the built-in recommended preset", async () => {
  const config = await loadConfig(await project([{ extends: ["recommended"] }]));

  assert.ok(settingsFor(config, "src/a.ts").rules.length >= 3);
});

test("loadConfig rejects unknown rules, bad severities and a non-array config", async () => {
  await assert.rejects(loadConfig(await project([{ rules: { nope: "error" } }])), /Unknown rule "nope"/);
  await assert.rejects(
    loadConfig(await project([{ extends: ["./rules"], rules: { "no-todo": "fatal" } }])),
    /Invalid severity "fatal"/,
  );
  await assert.rejects(loadConfig(await project({ rules: {} })), /must be an array/);
});
