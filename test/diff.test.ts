import assert from "node:assert/strict";
import { test } from "node:test";
import { parseChangedLines } from "../src/diff.ts";

test("parseChangedLines collects new-side lines of every hunk and skips pure deletions", () => {
  const diff = [
    "diff --git a/a.ts b/a.ts",
    "--- a/a.ts",
    "+++ b/a.ts",
    "@@ -1 +1 @@",
    "-old",
    "+new",
    "@@ -10,0 +11,2 @@",
    "+x",
    "+y",
    "@@ -20,3 +21,0 @@",
    "-gone",
  ].join("\n");

  assert.deepEqual([...parseChangedLines(diff)], [1, 11, 12]);
});
