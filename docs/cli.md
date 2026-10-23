# CLI

```bash
lanelint check [paths...]       # check the project
lanelint describe [path]        # the structure, or what applies to one path
lanelint rules list             # active rules
lanelint rules explain <id>     # what a rule checks and how to fix findings
lanelint rules docs             # write Markdown docs for the rules
```

Every command takes `--config <path>`. `--debug` logs what lanelint does, and `--help`
shows the options of a command.

## check

```bash
lanelint check                              # the whole project
lanelint check src/features/calendar        # only report on these paths
lanelint check --changed --new              # only what the current change caused
lanelint check --base origin/main --new     # in CI
lanelint check --rule boundaries/entry-only # one rule
```

| Flag                 | Description                                                         |
| -------------------- | ------------------------------------------------------------------- |
| `[paths...]`         | Report only on findings in these files or directories               |
| `--changed`          | Report only on files that differ from the base ref                  |
| `--new`              | Report only findings that do not exist at the base ref              |
| `--base <ref>`       | Base ref for `--changed`, `--new`, and change rules. Default `HEAD` |
| `--rule <id>`        | Run only this rule. Repeat the flag or separate ids with commas     |
| `--fail-on <level>`  | `error`, `warn`, or `never`. Overrides `failOn` in the config       |
| `--format <format>`  | `compact` (default) or `json`                                       |
| `--max-findings <n>` | Print at most `n` findings in compact output. Default `50`          |
| `--no-cache`         | Parse and resolve everything instead of reusing earlier runs        |

Paths and `--changed` limit what is reported, not what is checked: a cycle is still found
when only one of its files changed.

lanelint keeps the imports and exports of each file in `node_modules/.cache/lanelint`, keyed
by the file's git hash, so the next check reads and parses only the files that changed. It also
keeps what each import resolved to, until a file is added or removed, or a tsconfig,
package.json, lockfile, or `node_modules` changes. The cache is skipped when the project root
has no `node_modules`.

### Compact output

One line per finding, an optional hint, and a summary:

```
src/features/calendar/hooks/useSlots.ts:1 error boundaries/entry-only Import src/features/booking through its entry file, not src/features/booking/components/bookingPage.ts.
  hint: Export what you need from src/features/booking/index.ts and import it from there.
1 error, 0 warnings in 15 files (92 ms)
```

When there are more findings than `--max-findings`, the summary counts the rest per rule, so
the next run can be narrowed with a path or `--rule`. Colors are only used in a terminal.

### JSON output

```json
{
  "version": 1,
  "summary": {
    "errors": 1,
    "warnings": 0,
    "files": 15,
    "durationMs": 92,
    "failed": true,
    "onlyNew": false,
    "base": "HEAD",
    "stats": {
      "filesRead": 15,
      "filesParsed": 12,
      "modulesFromCache": 0,
      "importsResolved": 31,
      "resolutionsFromCache": 0
    }
  },
  "findings": [
    {
      "ruleId": "boundaries/entry-only",
      "severity": "error",
      "message": "Import src/features/booking through its entry file, not src/features/booking/components/bookingPage.ts.",
      "hint": "Export what you need from src/features/booking/index.ts and import it from there.",
      "location": { "kind": "file", "path": "src/features/calendar/hooks/useSlots.ts", "line": 1 },
      "related": [],
      "identity": "boundaries/entry-only|file|src/features/calendar/hooks/useSlots.ts|Import src/features/booking through its entry file, not src/features/booking/components/bookingPage.ts."
    }
  ]
}
```

`version` changes only when the format changes in a breaking way. `identity` never contains
line numbers. `stats` counts the work the check did: files read, files parsed, modules taken
from the cache, specifiers resolved, and resolutions taken from the cache, over the working tree
and, with `--new`, the base.

## describe

```bash
lanelint describe                                       # the whole structure
lanelint describe src/features/calendar/hooks/useSlots.ts   # what applies to one path
```

Prints the structure as Markdown: the elements with their patterns, entry files, and
descriptions, what each element may import, the conventions that apply, and the files that
must change together. With a path, it shows only what applies there. The path does not have
to exist yet, so an agent can ask before it creates a file. `--format json` prints the same
data as JSON.

## rules list

Lists the active rules with their level and description, and how many overrides change them.

## rules explain

```bash
lanelint rules explain boundaries/entry-only
```

Prints what a rule checks, its level in this project, what it enforces with the configured
options, and how to fix its findings.

## rules docs

```bash
lanelint rules docs                           # write docs/rules
lanelint rules docs --out docs/architecture   # write somewhere else
lanelint rules docs --check                   # exit 1 when the docs are out of date
lanelint rules docs --plugin local            # only one plugin
```

Writes a `README.md` that lists every rule, and one page per plugin with the rule's
description, default level, docs, options, and an example. The pages are made from the rules
themselves, so they stay correct when you run the command again after a change.

| Flag              | Description                                                               |
| ----------------- | ------------------------------------------------------------------------- |
| `--out <dir>`     | Directory to write to. Default `docs/rules`                               |
| `--check`         | Write nothing. Exit with `1` when a page is missing, differs, or is stale |
| `--plugin <name>` | Only document this plugin. Repeat the flag or separate names with commas  |

Generated pages start with a comment that marks them as generated. Pages with that comment
that are no longer generated, for example after a plugin is removed, are deleted. Other files
in the directory are left alone. Exclude the directory from your formatter so it does not
change the generated files.

See [Writing rules](writing-rules.md#documentation) for how a plugin gets good pages.

## Exit codes

| Code | Meaning                                                                    |
| ---- | -------------------------------------------------------------------------- |
| `0`  | No findings at the `failOn` level                                          |
| `1`  | Findings at the `failOn` level, or rule docs out of date with `--check`    |
| `2`  | lanelint could not run: a bad flag, a missing config, or an invalid config |
