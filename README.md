# pluis

Dat is niet pluis; lints code against plain-language rules with Claude.

pluis is ESLint for what ESLint cannot express. A rule is a Markdown file that explains, with bad and good examples, what readable code looks like. pluis asks Claude whether each file follows each rule and reports every finding on one line.

```console
$ npx pluis src/publish.ts
src/publish.ts:12 error one-step-per-statement Give the loaded user its own statement before formatting it.
src/publish.ts:30 warn names-say-what-value-is Rename `data` to say it holds open invoices.
```

## Requirements

pluis runs every check through `claude -p`, the [Claude Code](https://docs.claude.com/en/docs/claude-code) CLI. Install it and log in yourself; pluis runs under your own Claude Code login, whether that is a subscription or an API key, and never reads, stores or asks for credentials.

Node.js 22.18 or later.

## Usage

```sh
npx pluis [--diff <base>] [--format text|json] <files...>
```

`--diff <base>` keeps only findings on lines changed since `<base>`, such as `--diff origin/main`. Untracked files count as wholly changed. Without it pluis reports on whole files.

`--format json` prints an array of `{ path, line, severity, rule, message, quote }` for programs. The default prints `path:line severity rule message`, one line per finding.

pluis exits 1 when a finding has severity `error`, 0 when only `warn` and `info` findings remain, and 2 on a usage, config or `claude` failure.

## Configuration

pluis reads `pluis.json` from the current directory: a flat array of entries, applied in order to every file their `files` globs match. An entry without `files` applies to every file.

```json
[
  { "extends": ["recommended", "./rules"] },
  { "files": ["legacy/**"], "rules": { "names-say-what-value-is": "warn" } },
  { "files": ["src/payments/**"], "model": "sonnet" }
]
```

`extends` turns on every rule in a preset at `error`. `recommended` is the built-in preset; a path starting with `.` or `/` names a directory of your own rule files, relative to `pluis.json`.

`rules` sets a rule to `error`, `warn`, `info` or `off`. A rule's id is its file name without `.md`.

`model` is passed to `claude -p --model`; it defaults to `haiku`.

## Writing a rule

One Markdown file per rule. The frontmatter is optional: `languages` limits the rule to files of those languages, by extension (`typescript`, `javascript`, `php`, `python`, `ruby`, `go`, `rust`, `java`, `kotlin`, `swift`, `csharp`, `c`, `cpp`, `shell`, `vue`, `svelte`), and `exclude` skips files matching those globs.

````md
---
languages: [typescript, javascript]
exclude: ["**/*.test.ts"]
---
# No magic numbers

Give a number that carries meaning a name.

## Bad

```ts
setTimeout(refresh, 86400000);
```

## Good

```ts
const oneDayInMs = 24 * 60 * 60 * 1000;
setTimeout(refresh, oneDayInMs);
```
````

Every finding quotes the code it is about. pluis drops a finding whose quote does not appear on the line it names, so a finding cannot point at code that is not there.

## The recommended preset

`blank-line-between-steps` asks for a blank line between distinct steps of a function. `one-step-per-statement` flags calls stacked inside each other's arguments. `names-say-what-value-is` flags names such as `data` or `tmp` that hold a domain value.

## Development

```sh
npm install
npm test
```

The tests stub `claude` with `test/stub/claude`, so they make no model calls.
