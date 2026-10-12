import { spawn } from "node:child_process";
import type { Citation } from "./citation.ts";
import type { Rule } from "./rule.ts";

export type RawFinding = Citation & { message: string };

const systemPrompt = `You are a code linter that checks one file against one rule.
Report only violations of that rule, nothing else. Report nothing when the file follows the rule.
For each violation give the line number, a quote copied character for character from that line, and a one-sentence message that says what to change.`;

const schema = JSON.stringify({
  type: "object",
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          line: { type: "integer" },
          quote: { type: "string" },
          message: { type: "string" },
        },
        required: ["line", "quote", "message"],
      },
    },
  },
  required: ["findings"],
});

export function buildPrompt(rule: Rule, path: string, source: string): string {
  const numbered = source
    .split("\n")
    .map((line, index) => `${index + 1}| ${line}`)
    .join("\n");

  return `Rule: ${rule.id}\n\n${rule.text}\n\nFile: ${path}\n\n${numbered}\n`;
}

export async function check(rule: Rule, path: string, source: string, model: string): Promise<RawFinding[]> {
  const args = [
    "-p",
    "--model", model,
    "--output-format", "json",
    "--json-schema", schema,
    "--system-prompt", systemPrompt,
    "--tools", "",
    "--no-session-persistence",
  ];
  const stdout = await run(args, buildPrompt(rule, path, source));
  const result = JSON.parse(stdout);

  if (result.is_error || !result.structured_output) {
    throw new Error(`claude failed on ${path} for rule ${rule.id}: ${result.result ?? stdout}`);
  }

  return result.structured_output.findings;
}

function run(args: string[], input: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("claude", args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`claude exited with ${code}: ${stderr.trim() || stdout.trim()}`));
      }
    });
    child.stdin.end(input);
  });
}
