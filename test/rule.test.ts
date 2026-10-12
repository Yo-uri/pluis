import assert from "node:assert/strict";
import { test } from "node:test";
import { appliesTo, parseRule } from "../src/rule.ts";

const source = `---
languages: [typescript, php]
exclude:
  - "**/*.test.ts"
  - vendor/**
---
# No magic numbers

Name the number.

## Bad

\`\`\`ts
setTimeout(run, 86400000);
\`\`\`
`;

test("parseRule reads languages and exclude from frontmatter and keeps the body", () => {
  const rule = parseRule("no-magic-numbers", source);

  assert.equal(rule.id, "no-magic-numbers");
  assert.deepEqual(rule.languages, ["typescript", "php"]);
  assert.deepEqual(rule.exclude, ["**/*.test.ts", "vendor/**"]);
  assert.match(rule.text, /^# No magic numbers/);
  assert.doesNotMatch(rule.text, /languages:/);
});

test("parseRule accepts a rule without frontmatter", () => {
  const rule = parseRule("plain", "# Plain\n\nBody.\n");

  assert.equal(rule.languages, undefined);
  assert.equal(rule.text, "# Plain\n\nBody.\n");
});

test("appliesTo matches language by extension and honours exclude", () => {
  const rule = parseRule("no-magic-numbers", source);

  assert.equal(appliesTo(rule, "src/a.ts"), true);
  assert.equal(appliesTo(rule, "app/Http/Kernel.php"), true);
  assert.equal(appliesTo(rule, "main.py"), false);
  assert.equal(appliesTo(rule, "src/a.test.ts"), false);
  assert.equal(appliesTo(rule, "vendor/lib/x.php"), false);
});

test("appliesTo takes every file when a rule names no languages", () => {
  const rule = parseRule("plain", "# Plain\n");

  assert.equal(appliesTo(rule, "Makefile"), true);
});
