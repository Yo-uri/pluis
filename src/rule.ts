import { readdir, readFile } from "node:fs/promises";
import { basename, extname, join, matchesGlob } from "node:path";

export type Rule = {
  id: string;
  languages?: string[];
  exclude?: string[];
  text: string;
};

const extensionsByLanguage: Record<string, string[]> = {
  typescript: [".ts", ".tsx", ".mts", ".cts"],
  javascript: [".js", ".jsx", ".mjs", ".cjs"],
  php: [".php"],
  python: [".py"],
  ruby: [".rb"],
  go: [".go"],
  rust: [".rs"],
  java: [".java"],
  kotlin: [".kt", ".kts"],
  swift: [".swift"],
  csharp: [".cs"],
  c: [".c", ".h"],
  cpp: [".cpp", ".cc", ".hpp"],
  shell: [".sh", ".bash", ".zsh", ".fish"],
  vue: [".vue"],
  svelte: [".svelte"],
};

export function parseRule(id: string, source: string): Rule {
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!frontmatter) {
    return { id, text: source };
  }

  const fields = parseFrontmatter(frontmatter[1]);
  const text = source.slice(frontmatter[0].length).replace(/^\s+/, "");

  return { id, languages: fields.languages, exclude: fields.exclude, text };
}

function parseFrontmatter(yaml: string): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  let listKey: string | undefined;

  for (const line of yaml.split(/\r?\n/)) {
    const item = line.match(/^\s+-\s*(.+)$/);
    if (item && listKey) {
      fields[listKey].push(unquote(item[1]));
      continue;
    }

    const field = line.match(/^(\w+):\s*(.*)$/);
    if (!field) {
      continue;
    }

    const [, key, value] = field;
    const flowList = value.match(/^\[(.*)\]$/);
    listKey = undefined;

    if (flowList) {
      fields[key] = flowList[1].split(",").map(unquote).filter(Boolean);
    } else if (value === "") {
      fields[key] = [];
      listKey = key;
    } else {
      fields[key] = [unquote(value)];
    }
  }

  return fields;
}

function unquote(value: string): string {
  return value.trim().replace(/^(["'])(.*)\1$/, "$2");
}

export function appliesTo(rule: Rule, path: string): boolean {
  const excluded = rule.exclude?.some((pattern) => matchesGlob(path, pattern)) ?? false;
  if (excluded) {
    return false;
  }

  if (!rule.languages) {
    return true;
  }

  const extension = extname(path).toLowerCase();

  return rule.languages.some((language) => extensionsByLanguage[language.toLowerCase()]?.includes(extension));
}

export async function loadRules(dir: string): Promise<Rule[]> {
  const names = (await readdir(dir)).filter((name) => name.endsWith(".md")).sort();

  return Promise.all(
    names.map(async (name) => parseRule(basename(name, ".md"), await readFile(join(dir, name), "utf8"))),
  );
}
