export type Citation = {
  line: number;
  quote: string;
};

export function isCited(lines: string[], { line, quote }: Citation): boolean {
  const needle = quote.trim();
  const cited = lines[line - 1];

  return needle !== "" && cited !== undefined && cited.includes(needle);
}
