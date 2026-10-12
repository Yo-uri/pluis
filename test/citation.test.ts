import assert from "node:assert/strict";
import { test } from "node:test";
import { isCited } from "../src/citation.ts";

const lines = ["const a = 1;", "  setTimeout(run, 86400000);", ""];

test("isCited accepts a quote found on the reported line", () => {
  assert.equal(isCited(lines, { line: 2, quote: "setTimeout(run, 86400000)" }), true);
  assert.equal(isCited(lines, { line: 2, quote: "  86400000  " }), true);
});

test("isCited rejects a quote on another line, out of range or empty", () => {
  assert.equal(isCited(lines, { line: 1, quote: "86400000" }), false);
  assert.equal(isCited(lines, { line: 9, quote: "a" }), false);
  assert.equal(isCited(lines, { line: 3, quote: " " }), false);
});
