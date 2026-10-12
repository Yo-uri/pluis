import { execFile } from "node:child_process";
import { promisify } from "node:util";

const git = promisify(execFile);

export function parseChangedLines(diff: string): Set<number> {
  const changed = new Set<number>();

  for (const hunk of diff.matchAll(/^@@ -\S+ \+(\d+)(?:,(\d+))? @@/gm)) {
    const start = Number(hunk[1]);
    const count = hunk[2] === undefined ? 1 : Number(hunk[2]);

    for (let line = start; line < start + count; line++) {
      changed.add(line);
    }
  }

  return changed;
}

export async function changedLines(base: string, path: string): Promise<Set<number> | "all"> {
  const untracked = await git("git", ["ls-files", "--others", "--exclude-standard", "--", path]);
  if (untracked.stdout.trim() !== "") {
    return "all";
  }

  const forkPoint = (await git("git", ["merge-base", base, "HEAD"])).stdout.trim();
  const diff = await git("git", ["diff", "--unified=0", "--no-color", "--no-ext-diff", forkPoint, "--", path]);

  return parseChangedLines(diff.stdout);
}
