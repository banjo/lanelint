# Concepts

## Elements

Elements are the named parts of your architecture, such as features, domains, layers, or
packages. You define them in the config with directory patterns:

```ts
elements: [
  { type: 'feature', pattern: 'src/features/:name', description: 'A user-facing feature.' },
  { type: 'domain', pattern: 'src/common/:name', entry: 'index.ts' },
  { type: 'shared', pattern: 'src/:name', where: { name: ['hooks', 'utils'] } },
],
```

- A pattern matches directories relative to the project root. Each segment is a literal,
  `:capture` (one segment, captured under that name), or `*` (one segment, not captured).
- `where` limits the values of a capture. Above, `shared` matches only `src/hooks` and
  `src/utils`.
- A file belongs to the first element whose pattern matches its directory or a parent of it,
  so put specific patterns before general ones.
- `entry` lists the element's entry files, relative to its root. The default is `index.ts`,
  `index.tsx`, `index.js`, and the other source extensions. Rules such as `entry-only` and
  `public-api` use them.
- `description` is shown by `pilotlint describe`, so agents know what belongs where.

Every file inside `src/features/calendar` belongs to the element `src/features/calendar` of
type `feature`, with the capture `name: 'calendar'`.

Elements are optional. Rules about names, required files, or changes work without them.

### Selectors

Rule options refer to elements and files with selectors:

```ts
'feature'                                         // elements of a type
{ type: 'feature', captures: { name: 'auth' } }   // one element
{ files: 'src/**/utils/**' }                      // files by glob
['feature', 'domain']                             // any of several
```

## Files and source files

`include` and `ignore` in the config decide which files belong to the project. Every file
type counts, so rules can check Markdown, JSON, or CSS files too. Files with a JavaScript or
TypeScript extension are source files: pilotlint parses them to find imports and exports.

`tests` decides which files are test files. Rules that skip test files have an
`includeTests` option to check them too.

pilotlint only reads and parses what the active rules need. A config with only naming rules
never reads the contents of a file.

## Imports

pilotlint resolves every import with the nearest `tsconfig.json`, including `paths`. An
import is one of:

- **internal:** a file in the project
- **external:** a package in `node_modules`
- **builtin:** a Node module such as `node:fs`
- **excluded:** a file in the repository that is outside `include`
- **unresolved:** nothing was found

An import of a workspace package resolves to the package's source, so boundaries between
packages in a monorepo work before anything is built.

## Findings

A finding is one problem: a location, a level, a rule id, a message, and often a hint.

```
src/features/calendar/hooks/useSlots.ts:1 error boundaries/entry-only Import src/features/booking through its entry file, not src/features/booking/components/bookingPage.ts.
  hint: Export what you need from src/features/booking/index.ts and import it from there.
```

The location is a file (with a line when there is one), a directory, an element, a path that
should exist, or the whole project, shown as `(project)`.

Every finding has an identity made of its rule id, its location path, and a key the rule
chooses. Line numbers are not part of it, so pilotlint can tell whether a finding already
existed before a change, even if the code moved.

## Levels

A rule is `'off'`, `'warn'`, or `'error'`. The level comes from three places, and the most
specific wins:

1. The rule's default level, used when you enable a rule without a level.
2. The config: `extends`, then `rules`, then `overrides`.
3. `failOn` decides which findings fail the run: `'error'` (the default), `'warn'`, or
   `'never'`. `--fail-on` overrides it for one run.

Exit codes:

| Code | Meaning                                                        |
| ---- | -------------------------------------------------------------- |
| `0`  | No findings at the `failOn` level                              |
| `1`  | Findings at the `failOn` level                                 |
| `2`  | pilotlint could not run, for example because of a config error |

## Changes

pilotlint can compare the working tree with a git ref, `HEAD` by default:

- `--changed` reports only on files that differ from the ref, including staged and untracked
  files. A finding is still shown when one of its related locations changed, such as a file in
  a cycle.
- `--new` reports only findings whose identity does not exist at the ref. This is how agents
  see only what they caused.
- `--base origin/main` compares with another ref, for example in CI.
- Rules from `@pilotlint/plugin-changes` use the same comparison, for example to require a
  translation file to change when messages change.

## Core rules

pilotlint reports a few problems itself, under the `pilotlint/` prefix:

- `pilotlint/config-changed` warns when the config differs from the base ref. A changed
  config changes the rules, so a human should review it. It cannot be turned off.
- `pilotlint/stale-config` warns about element patterns and overrides that match nothing.
- `pilotlint/parse-error` reports source files that cannot be parsed.
- `pilotlint/no-git` warns when a rule needs git and the project is not in a repository.

See [rules/pilotlint.md](rules/pilotlint.md) for details.
