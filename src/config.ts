import { readFile } from "node:fs/promises";
import { isAbsolute, join, matchesGlob, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { appliesTo, loadRules, type Rule } from "./rule.ts";

export type Severity = "error" | "warn" | "info" | "off";

type Entry = {
  files?: string[];
  extends?: string[];
  rules?: Record<string, Severity>;
  model?: string;
};

export type Config = {
  entries: Entry[];
  rules: Map<string, Rule>;
  presetRuleIds: Map<string, string[]>;
};

export type FileSettings = {
  model: string;
  rules: { rule: Rule; severity: Exclude<Severity, "off"> }[];
};

const severities = ["error", "warn", "info", "off"];
const presetsDir = fileURLToPath(new URL("../presets/", import.meta.url));

export async function loadConfig(dir: string): Promise<Config> {
  const parsed: unknown = JSON.parse(await readFile(join(dir, "pluis.json"), "utf8"));
  if (!Array.isArray(parsed)) {
    throw new Error("pluis.json must be an array of config entries");
  }

  const entries: Entry[] = parsed;

  const rules = new Map<string, Rule>();
  const presetRuleIds = new Map<string, string[]>();

  for (const entry of entries) {
    for (const preset of entry.extends ?? []) {
      if (presetRuleIds.has(preset)) {
        continue;
      }

      const presetRules = await loadRules(presetDir(dir, preset));
      presetRules.forEach((rule) => rules.set(rule.id, rule));
      presetRuleIds.set(preset, presetRules.map((rule) => rule.id));
    }
  }

  for (const entry of entries) {
    for (const [id, severity] of Object.entries(entry.rules ?? {})) {
      if (!rules.has(id)) {
        throw new Error(`Unknown rule "${id}" in pluis.json; extend the preset or directory that defines it`);
      }
      if (!severities.includes(severity)) {
        throw new Error(`Invalid severity "${severity}" for rule "${id}"; use one of ${severities.join(", ")}`);
      }
    }
  }

  return { entries, rules, presetRuleIds };
}

function presetDir(configDir: string, preset: string): string {
  const isPath = preset.startsWith(".") || isAbsolute(preset);

  return isPath ? resolve(configDir, preset) : join(presetsDir, preset);
}

export function settingsFor(config: Config, path: string): FileSettings {
  const severityById = new Map<string, Severity>();
  let model = "haiku";

  for (const entry of config.entries) {
    const matches = !entry.files || entry.files.some((pattern) => matchesGlob(path, pattern));
    if (!matches) {
      continue;
    }

    for (const preset of entry.extends ?? []) {
      config.presetRuleIds.get(preset)!.forEach((id) => severityById.set(id, "error"));
    }
    for (const [id, severity] of Object.entries(entry.rules ?? {})) {
      severityById.set(id, severity);
    }
    model = entry.model ?? model;
  }

  const rules = [...severityById]
    .map(([id, severity]) => ({ rule: config.rules.get(id)!, severity }))
    .filter((setting): setting is FileSettings["rules"][number] => setting.severity !== "off")
    .filter(({ rule }) => appliesTo(rule, path));

  return { model, rules };
}
