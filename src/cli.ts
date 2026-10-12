#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { relative } from "node:path";
import { parseArgs } from "node:util";
import { isCited } from "./citation.ts";
import { check } from "./claude.ts";
import { loadConfig, settingsFor, type Severity } from "./config.ts";
import { changedLines } from "./diff.ts";

type Finding = {
  path: string;
  line: number;
  severity: Exclude<Severity, "off">;
  rule: string;
  message: string;
  quote: string;
};

const usage = "Usage: pluis [--diff <base>] [--format text|json] <files...>";
const concurrency = 4;

async function lintFile(path: string, config: Awaited<ReturnType<typeof loadConfig>>, base?: string) {
  const { model, rules } = settingsFor(config, path);
  if (rules.length === 0) {
    return [];
  }

  const source = await readFile(path, "utf8");
  const lines = source.split("\n");
  const changed = base === undefined ? "all" : await changedLines(base, path);

  const tasks = rules.map(({ rule, severity }) => async () => {
    const raw = await check(rule, path, source, model);

    return raw
      .filter((finding) => isCited(lines, finding))
      .filter((finding) => changed === "all" || changed.has(finding.line))
      .map((finding): Finding => ({ path, line: finding.line, severity, rule: rule.id, message: finding.message, quote: finding.quote }));
  });

  return tasks;
}

async function runPool<T>(tasks: (() => Promise<T>)[], size: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;

  async function worker() {
    while (next < tasks.length) {
      const index = next++;
      results[index] = await tasks[index]();
    }
  }

  await Promise.all(Array.from({ length: Math.min(size, tasks.length) }, worker));

  return results;
}

function format(findings: Finding[], as: string): string {
  if (as === "json") {
    return JSON.stringify(findings, null, 2) + "\n";
  }

  return findings.map((finding) => `${finding.path}:${finding.line} ${finding.severity} ${finding.rule} ${finding.message}\n`).join("");
}

async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      diff: { type: "string" },
      format: { type: "string", default: "text" },
    },
  });

  if (positionals.length === 0 || !["text", "json"].includes(values.format)) {
    console.error(usage);
    return 2;
  }

  const config = await loadConfig(process.cwd());
  const paths = positionals.map((file) => relative(process.cwd(), file).split("\\").join("/"));
  const tasks = (await Promise.all(paths.map((path) => lintFile(path, config, values.diff)))).flat();
  const findings = (await runPool(tasks, concurrency))
    .flat()
    .sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line || a.rule.localeCompare(b.rule));

  process.stdout.write(format(findings, values.format));

  return findings.some((finding) => finding.severity === "error") ? 1 : 0;
}

main(process.argv.slice(2)).then(
  (code) => (process.exitCode = code),
  (error: Error) => {
    console.error(`pluis: ${error.message}`);
    process.exitCode = 2;
  },
);
