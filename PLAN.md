# archlint plan

`archlint` is a working name. The unscoped npm name is taken by an abandoned
package, so the final name is decided before the first release.

## Goal

A fast, structure-agnostic architecture checker for TypeScript projects. One
config file describes the whole structure of a codebase: which parts exist, how
they may depend on each other, how files and directories are named and shaped,
and which files must change together. An AI agent reads the structure before it
writes code, runs the CLI right after each change, and gets a short, actionable
list of the problems it introduced.

## Principles

- **Agnostic core.** The core knows nothing about features, layers, or any
  folder layout. Structure comes from user config; rules come from plugins.
- **One config owns structure.** Rules that overlap with a linter (for example
  `no-default-export`) are still in scope. One command and one config cover
  everything an agent must follow about structure.
- **Prevent, verify, enforce.** The agent learns the structure before writing
  (`archlint describe`), checks its work after each change (`archlint check`),
  and commit hooks and CI catch anything that slips through.
- **Show the agent what it caused.** In a codebase with existing findings, the
  agent sees only the findings its change introduced.
- **No way around the rules from inside the code.** archlint has no inline
  suppression comments, and config changes are always reported.
- **Fast enough to run after every change.** Work is done lazily and limited to
  what the active rules need.
- **TypeScript first.** Configs, rules, and plugins are written in TypeScript,
  and rule ids and options are type-checked in the config.

## Non-goals for v1

- Editor integration (LSP, ESLint or oxlint adapter)
- Autofix
- Type-aware rules (no type checker is run)
- Persistent cache between runs
- Running type checks, linters, or tests (see
  [Verification scope](#verification-scope-structure-only))

Each of these except the last can be added later without breaking the rule API.

## Decisions

### A standalone tool, not an ESLint plugin

ESLint checks one file at a time. The most valuable architecture rules need the
whole project: dependency cycles, whether a file is reachable from an
element's public entry, rules about directories, and rules about which files
changed together. In ESLint these need module-level caches that break with
`--cache` and in editors. Many target projects also use a linter other than
ESLint (Biome, Oxlint), and adding a second linter only for architecture rules
is a cost. A standalone CLI also controls its own output, scoping, and exit
codes, which matters for agents.

The rule API borrows from ESLint where it fits (`create` with visitors, `meta`,
plugins with `configs`, `overrides`) so it feels familiar.

### Verification scope: structure only

archlint checks structure: files, directories, dependencies, exports, and
changes that belong together. Type checks, lint, and tests stay with the tools
built for them (for example `vp check` and the project's test runner). The
agent skill tells the agent which commands to run and in what order. Running
other tools and merging their output would duplicate `vp check` and turn
archlint into a different product.

### Elements with captured path segments

Structure is described with element patterns such as `src/features/:name`.
Alternatives considered:

| Model | Why not |
|---|---|
| No elements, paths only | Every plugin would parse paths itself, and generic rules such as cycles between groups could not be shared |
| Tags, several per file (as in Sheriff or Nx) | More flexible but harder to reason about, and every rule must handle sets of tags. Can be added on top of elements later |

### Three official plugins

Plugins are split by the question they answer:

- `boundaries`: may this part of the code depend on that part, or on that
  package? Needs the import graph. The name follows the established term
  "module boundaries" (Nx, Sheriff, eslint-plugin-boundaries).
- `conventions`: does this file or directory look right, and does everything
  that must exist exist? Works without elements.
- `changes`: did everything that must change together change together? Needs
  git.

Rules that a linter also has are included on purpose, because one config should
describe the whole structure. archlint can also scope them per element.
Project-specific rules belong in each project's local plugin.

### Oxc for parsing and resolution

See [Parsing and resolution](#parsing-and-resolution). The AST is part of the
public rule API, so this choice is made before v1 and not changed later.

### Vite+ for development

Vite+ (VoidZero, MIT) replaces Turborepo, Biome, and separate tool configs. It
is a dev dependency only, so users of archlint are not affected by it.

VoidZero joined Cloudflare in June 2026. Both companies have stated that Vite,
Vitest, Rolldown, Oxc, and Vite+ stay MIT-licensed, vendor-neutral, and led by
the same team. The Cloudflare connection concerns app hosting on Workers and
does not affect a CLI library.

The real dependency on VoidZero is `oxc-parser` and `oxc-resolver` in the
published packages. Both are MIT and only called from `@archlint/core`, so they
can be pinned, forked, or replaced in one place.

### API decisions made before v1

These would be breaking changes later, so they are part of the first version:

1. Findings have a stable identity that does not depend on line numbers.
2. All file access goes through a snapshot interface, so the same engine runs
   on the working tree, a git ref, or in-memory test fixtures.
3. The project knows every file. Only source files are parsed.
4. Findings can be reported on files (including files that do not exist),
   directories, elements, import edges, and the project.
5. Import edges carry their kind, whether they are type-only, the imported
   names, and the package name for external imports.
6. Rules can describe what they enforce with their current options.

## Repository

Monorepo using pnpm workspaces and Vite+.

```
archlint/
  packages/
    core/                 @archlint/core
    archlint/             archlint (CLI and main entry point)
    plugin-boundaries/    @archlint/plugin-boundaries
    plugin-conventions/   @archlint/plugin-conventions
    plugin-changes/       @archlint/plugin-changes
  examples/
    feature-folders/      end-to-end fixture with feature and common folders
    monorepo/             end-to-end fixture with packages/*
  tooling/
    tsconfig/             private shared tsconfig
  archlint.config.ts      archlint checks its own repo
  vite.config.ts          Vite+ config: lint, fmt, test, pack, run, staged
  pnpm-workspace.yaml
```

### Development toolchain

The repo uses the VoidZero stack through Vite+, which is a dev dependency only.
No published package depends on `vite-plus`.

| Task | Command | Tool |
|---|---|---|
| Format, lint, type check | `vp check` | Oxfmt, Oxlint (type-aware) |
| Test | `vp test` | Vitest |
| Build packages | `vp pack` | tsdown (Rolldown) |
| Monorepo tasks with caching | `vp run <task> -r` | Vite Task |
| Pre-commit checks | `vp staged` | Vite+ commit hooks |
| Versioning and publishing | `changeset` | Changesets |

Contributors use the project-local CLI (`pnpm exec vp ...`). The global `vp`
installation is optional. Changesets is used because neither VoidZero nor unjs
has an equivalent for publishing several packages from one repo.

If Vite+ has to be replaced, each tool also runs on its own (Oxlint, Oxfmt,
Vitest, tsdown), and Turborepo can take over the tasks from `vp run`. The
trade-off of using Vite+ is that it ships fixed versions of these tools, so they
are upgraded on its release schedule.

### Runtime dependencies

Kept small and chosen for startup time. Oxc and unjs are preferred. All
dependencies are kept at their latest versions.

| Need | Package | Used in |
|---|---|---|
| Parsing | `oxc-parser` | core |
| Module resolution | `oxc-resolver` | core |
| Path handling with `/` on all platforms | `pathe` (unjs) | core |
| File discovery | `tinyglobby` | core |
| Glob matching for `overrides`, `ignore`, and rule options | `picomatch` | core |
| Options schema types | `@standard-schema/spec` | core (types only) |
| Running git | `node:child_process` | core |
| CLI commands | `citty` (unjs) | archlint |
| Config loading | `c12` (unjs) | archlint |
| Colors | `node:util` `styleText` | archlint |

All packages are ESM only and target the current Node LTS.

## Packages

| Package | Contents | Used by |
|---|---|---|
| `@archlint/core` | Engine, snapshots, project model, elements, parsing and resolution, git changes, config resolution, `defineRule`, `definePlugin`, `defineConfig`, types. `@archlint/core/testing` exports the rule test helpers. No CLI code. | Plugin authors (as a peer dependency), the CLI |
| `archlint` | citty CLI, config loading, reporters, agent skill. Re-exports `defineConfig` and the public types from core so users install one package. | Everyone using the tool |
| `@archlint/plugin-boundaries` | Rules about dependencies between elements and on packages | Any project |
| `@archlint/plugin-conventions` | Rules about names, placement, required files, export shape, and suppression comments | Any project |
| `@archlint/plugin-changes` | Rules about files that must or must not change | Projects in git |

Project-specific rules do not live in this repo. For example, the VGCS
Queenbolt rules live in Queenbolt as a local plugin.

### Naming conventions

- Official plugins: `@archlint/plugin-<name>`
- Community plugins: `archlint-plugin-<name>` or `@scope/archlint-plugin-<name>`
- Shareable configs without rules: `archlint-config-<name>`
- Plugins declare `@archlint/core` as a peer dependency

## Core concepts

### Snapshots

All file access goes through a snapshot. A snapshot lists paths and reads file
contents.

| Snapshot | Used for |
|---|---|
| Working tree | Normal runs |
| Git ref | The base side of `--new` |
| Memory | Rule tests |

The git ref snapshot is the working tree with changed paths replaced by their
content at the ref. Files added since the ref are removed, and deleted files
are restored. Parse results are shared between snapshots for files whose
content is the same, so a `--new` run only parses changed files twice.

### Project model

`include`, `ignore`, and `tests` globs in the config decide which files belong
to the project and which are test files. Every file type is included: CSS,
JSON, Markdown, and so on. Files with a JS or TS extension are source files and
can be parsed.

The engine builds data in tiers and only builds a tier when an active rule
needs it.

| Tier | Data | Source | Built for |
|---|---|---|---|
| 1. Paths | Files, directories, elements, packages, test flag | glob | All files |
| 2. Text | File contents as a string | snapshot | Files in scope that a rule reads |
| 3. Module info | Imports, re-exports, dynamic imports, exports | `oxc-parser` module record, without materializing the AST | Source files in scope, or all source files when a project rule is active |
| 4. AST | ESTree program and comments | `oxc-parser` program (lazy) | Source files in scope only |

Test files are part of the project model, and each rule decides whether to
check them.

### Import edges

Every specifier is resolved with `oxc-resolver`, not only relative ones. Each
source file is resolved with its nearest `tsconfig.json`, so monorepo packages
with their own `paths` work.

```ts
interface ImportEdge {
  from: ProjectFile;
  specifier: string;
  line: number;
  kind: 'import' | 'export' | 'dynamic' | 'require';
  typeOnly: boolean;
  names: string[]; // imported or re-exported names; '*' for namespaces
  target:
    | { type: 'internal'; file: ProjectFile }
    | { type: 'external'; package: string; path?: string }
    | { type: 'builtin'; module: string }
    | { type: 'unresolved' };
}
```

An edge that resolves inside the project is internal, including workspace
packages reached through symlinks. An edge into `node_modules` is external and
keeps the package name.

### Packages

Each file knows its nearest `package.json`: the package name, its directory,
and its declared dependencies. Rules such as `no-undeclared-dependency` use it.

### Changes

`ctx.changes` lists files that differ from a base ref, each with a status:
`added`, `modified`, `deleted`, or `renamed`. The base is `HEAD` by default
(including staged and untracked files) and can be set with `--base <ref>`, for
example `--base origin/main` in CI. Changes are computed only when a rule or a
flag needs them. Outside a git repository, `ctx.changes` is unavailable, and
rules that need it report one `archlint/no-git` finding instead.

### Elements

Elements map parts of the file tree to named architectural units. They are
optional. Projects without elements can still use path, text, module, and AST
rules.

```ts
elements: [
  {
    type: 'feature',
    pattern: 'src/features/:name',
    entry: 'index.ts',
    description: 'A user-facing feature. Other code imports it only through index.ts.',
  },
  { type: 'domain', pattern: 'src/common/:name', entry: 'index.ts' },
  { type: 'shared', pattern: 'src/:name', where: { name: ['api', 'components', 'hooks', 'utils'] } },
]
```

Pattern rules:

- Patterns match directories, relative to the project root, with `/` as the
  separator on every platform.
- A segment is a literal, `:capture` (one segment, captured), or `*` (one
  segment, not captured).
- `where` restricts the allowed values of a capture.
- A file belongs to the first element whose pattern matches a prefix of its
  directory. Order matters, so more specific patterns go first.
- `entry` lists the element's public entry files, relative to its root. It is
  used by `entry-only`, `public-api`, and `no-orphans`.
- `description` is shown by `archlint describe`.

Each element, and each file and directory inside one, gets:

```ts
interface ElementInfo {
  type: string;
  id: string; // the element root path, unique per element
  captures: Record<string, string>;
  root: string;
  relativePath: string; // path inside the element
  isEntry: boolean;
}
```

Examples of other layouts:

```ts
// Feature-Sliced Design
elements: [
  { type: 'slice', pattern: 'src/:layer/:slice', where: { layer: ['features', 'entities', 'widgets', 'pages'] } },
  { type: 'layer', pattern: 'src/:layer' },
]

// Monorepo
elements: [{ type: 'package', pattern: 'packages/:name', entry: 'src/index.ts' }]
```

Multiple elements per file (tags) and capture templates in selectors are
possible later additions. They are not part of v1.

### Rules

```ts
import { defineRule } from '@archlint/core';
import * as v from 'valibot';

export const entryOnly = defineRule({
  meta: {
    description: 'Import other elements through their entry files.',
    severity: 'error',
    docs: 'Longer explanation shown by `archlint rules explain`, including how to fix a finding.',
  },
  options: v.object({ elements: v.array(v.string()) }),
  describe: (options) => `Code outside a ${options.elements.join(' or ')} imports it only through its entry files.`,
  create: (ctx) => ({
    import(edge) {
      if (edge.target.type !== 'internal') return;
      const from = edge.from.element;
      const to = edge.target.file.element;
      if (to && ctx.options.elements.includes(to.type) && from?.id !== to.id && !to.isEntry) {
        ctx.report({
          at: edge,
          message: `Import ${to.root} through its entry file.`,
          hint: `Export what you need from the entry file of ${to.root} and import that instead.`,
        });
      }
    },
  }),
});
```

- `meta.severity` is the default level set by the rule author: `'warn'` or `'error'`.
- `meta.docs` is Markdown shown by `archlint rules explain <id>`. Rule-specific
  knowledge lives here, so the agent skill stays generic.
- `options` is any Standard Schema validator (Zod, Valibot, ArkType). The
  inferred type types `ctx.options` and the rule's options in the config.
- `describe(options)` returns one or more sentences about what the rule
  enforces with these options. `archlint describe` uses it. Without it,
  `meta.description` is used.

#### Reporting

```ts
ctx.report({
  at,          // where the finding is
  message,     // what is wrong; must not contain line numbers
  hint?,       // a concrete next step
  key?,        // identity; defaults to the message
  related?,    // other locations, for example the edges of a cycle
});
```

`at` is one of:

| Location | Example |
|---|---|
| A file, optionally with line and column | A default export |
| A path that does not exist | A missing companion file |
| A directory | A forbidden directory name |
| An element | An element without an entry file |
| An import edge | A deep import |
| The project | A missing changeset |

The identity of a finding is its rule id, the path of its location, and its
key. It does not include line numbers, so findings can be matched between the
working tree and a base ref after lines move.

#### Visitors

Visitors decide which tiers are built:

| Visitor | Receives | Needs tier | Runs for |
|---|---|---|---|
| `file` | File facts | 1 | Files in scope |
| `directory` | Directory facts | 1 | Directories in scope |
| `element` | Element facts and its files | 1 | Elements with a file in scope |
| `text` | File and its contents | 2 | Files in scope |
| `module` | Source file and its module info | 3 | Source files in scope |
| `import` | Import edge | 3 + resolution | Edges from source files in scope |
| `ast` | Source file, ESTree program, and comments | 4 | Source files in scope |
| `project` | The project | Depends on use | Once per run |

If no active rule uses `text`, `module`, `import`, `ast`, or `project`, no file
is read.

#### Context

`ctx` gives every rule:

- `ctx.options`: validated options
- `ctx.report(...)`: see above
- `ctx.project`: the project, with `files`, `directories`, `elements`,
  `file(path)`, `exists(path)`, `text(path)`, `importsOf(file)`,
  `importersOf(file)`, `packageOf(file)`, and `configFile`
- `ctx.changes`: changed files compared with the base ref
- `ctx.isInScope(location)`: whether findings at a location are shown

Reading through `ctx.project` builds the tiers that are needed, so a `project`
visitor only pays for what it uses.

#### Shorthands

A shorthand covers the common "condition plus message" case:

```ts
export const typesFile = defineFileRule({
  meta: { description: 'No types.ts files.', severity: 'warn' },
  when: (file) => file.name === 'types.ts',
  message: 'Move these types to named files in models/.',
});
```

`defineDirectoryRule` works the same way.

### Core findings

Core reports some findings itself, under the `archlint/` prefix. They are
configured like any rule, except that `archlint/config-changed` cannot be
turned off.

| Id | Default | Reported when |
|---|---|---|
| `archlint/config-changed` | `warn` | The archlint config file differs from the base ref |
| `archlint/stale-config` | `warn` | An element pattern, override, or glob option matches nothing |
| `archlint/no-git` | `warn` | A rule needs git and there is no repository |
| `archlint/parse-error` | `error` | A source file cannot be parsed |

`archlint/config-changed` makes config changes visible. The skill tells the
agent to stop and ask a human, and code review is the final guard.

### Plugins and configs

```ts
export default definePlugin({
  name: 'boundaries', // rule id prefix
  rules: { 'entry-only': entryOnly, 'no-cycles': noCycles },
  configs: {
    recommended: { rules: { 'boundaries/no-cycles': 'error' } },
  },
});
```

Rule ids are `<plugin name>/<rule key>`. A plugin's configs register the
plugin automatically when used in `extends`. Local rules use the same shape:
`definePlugin({ name: 'local', rules })` in the project.

### Config

`archlint.config.ts` in the project root:

```ts
import { defineConfig } from 'archlint';
import boundaries from '@archlint/plugin-boundaries';
import changes from '@archlint/plugin-changes';
import conventions from '@archlint/plugin-conventions';
import local from './archlint/plugin';

export default defineConfig({
  include: ['src/**'],
  ignore: ['src/generated/**'],
  tests: ['**/*.test.{ts,tsx}', '**/tests/**'],
  failOn: 'error',
  elements: [
    { type: 'feature', pattern: 'src/features/:name', description: 'A user-facing feature.' },
    { type: 'domain', pattern: 'src/common/:name' },
  ],
  plugins: [boundaries, changes, conventions, local],
  extends: [boundaries.configs.recommended],
  rules: {
    'conventions/directory-case': ['error', { case: 'kebab' }],
    'boundaries/entry-only': ['error', { elements: ['feature'] }],
    'boundaries/restricted-packages': ['error', {
      packages: [{ name: '@mui/material', message: 'Use the design system components instead.' }],
    }],
    'changes/requires-change': ['error', {
      rules: [{ when: 'src/**/messages.ts', require: 'src/translations/en.json', hint: 'Run pnpm extract-intl.' }],
    }],
  },
  overrides: [
    {
      description: 'Feature and domain code uses named exports.',
      elements: ['feature', 'domain'],
      ignore: ['**/messages.ts'],
      rules: { 'conventions/no-default-export': 'error' },
    },
  ],
});
```

- `defineConfig` infers rule ids and option types from `plugins` and
  `extends`. Unknown rule ids and invalid options are type errors.
- A rule entry is `'off' | 'warn' | 'error'` or `[level, options]`.
- `overrides` select locations with `files`, `ignore`, and `elements`, and can
  have a `description`. Rules never implement their own scoping.
- Resolution order: `extends` in order, then top-level `rules`, then
  `overrides` in order. The last match wins.
- Each finding is checked against the config that applies at its location.
  The rule must be enabled there, and the level used is the level set there. A
  rule configured with different options in different places runs once per
  distinct options set. Findings located on the project use the top-level
  config.
- Config validation fails with exit code 2 for unknown rules, invalid options,
  or a rule that references an element type that is not defined.

The config is loaded with c12. If loading the TypeScript config dominates
startup, use Node's native type stripping instead.

### Severity and exit codes

Three layers, most specific wins:

1. Rule default: `meta.severity`
2. Config level: `rules`, `extends`, and `overrides`
3. Failure threshold: `failOn` in config, overridden by `--fail-on`

| `failOn` | Exit 1 when |
|---|---|
| `'error'` | At least one error |
| `'warn'` | At least one warning or error |
| `'never'` | Never; findings are reported only |

Exit code 2 means a usage or configuration error. Agents can tell "the code
breaks a rule" (1) from "the tool is misconfigured" (2).

## Parsing and resolution

`oxc-parser` and `oxc-resolver` are used directly. The AST in the rule API is
ESTree with TypeScript nodes, the same format used by ESLint,
typescript-eslint, and oxlint JS plugins.

Benchmark on VGCS Queenbolt (1,053 TS/TSX files, warm file cache):

| Step | TypeScript compiler API | oxc |
|---|---|---|
| Load library | 133 ms | 16 ms |
| Collect imports for all files | 260 ms | 60 ms (module info only) |
| Full AST for all files | included above | 194 ms |
| Resolve 3,083 local imports | 31 ms (with cache) | 12 ms, 0 unresolved |

Both found the same 3,083 imports. Glob (93 ms) and reading files (218 ms) are
now the largest costs.

Resolution uses `tsconfig: 'auto'` and `resolveFileSync(file, specifier)`, so
each file is resolved with its nearest tsconfig. For a git ref snapshot,
resolved paths are checked against the snapshot's file list. Imports of files
that only exist at the ref are resolved against that list with the configured
extensions.

Risks and mitigations:

- oxc is at 0.x and changes often. Pin exact versions and keep all oxc calls
  inside `@archlint/core`. The ESTree shape is stable across versions.
- Native binaries per platform. oxc ships a wasm fallback.
- JSDoc tags such as `@deprecated` are not attached to nodes. Core provides a
  helper that matches comments to nodes.

## Performance

Targets on a project with about 1,000 files, warm file cache:

- `archlint check --changed` without project rules: under 300 ms
- `archlint check` with all rules: under 1 s
- `archlint check --changed --new`: under 1.5 s

How:

- The CLI ships as prebuilt ESM. No `tsx` at runtime.
- Subcommands are lazy imports, as in the Queenbolt CLI.
- Tiers are built only when an active rule needs them, and ASTs only for files
  in scope.
- `check <paths>` and `--changed` limit reporting. The full graph is built
  only when a `project` rule needs it.
- Git is called only when changes are needed.
- `--new` shares parse results between snapshots.
- Files are read concurrently.
- Each run prints its duration, and CI fails if the example projects pass a
  time budget.

A cache of module info keyed by file size and mtime is a v2 option if reading
files remains the bottleneck.

## CLI

Built with citty and organized like the Queenbolt CLI:

```
packages/archlint/
  src/
    cli/
      index.ts              # runMain, --debug, lazy subCommands
      logger.ts
      features/
        check/
          index.ts          # archlint check
        describe/
          index.ts          # archlint describe
        rules/
          index.ts          # command group
          commands/
            list.ts         # archlint rules list
            explain.ts      # archlint rules explain <id>
      utils/
        configUtil.ts       # config loading and validation
    reporters/
      compactReporter.ts
      jsonReporter.ts
      markdownReporter.ts   # used by describe
    index.ts                # re-exports defineConfig and public types
  skills/
    archlint/SKILL.md
```

Commands:

```bash
archlint check [paths...]          # report findings in these files or directories
archlint check --changed           # files changed against the base ref
archlint check --changed --new     # only findings that are not at the base ref
archlint check --base origin/main --new
archlint check --rule boundaries/no-cycles
archlint check --fail-on never --format json
archlint describe                  # the structure as Markdown
archlint describe src/features/calendar   # what applies to this path
archlint rules list                # active rules, level, and source plugin or config
archlint rules explain <rule-id>   # description and docs for one rule
```

Flags on `check`:

| Flag | Meaning |
|---|---|
| `--changed` | Scope to files that differ from the base ref |
| `--new` | Show only findings whose identity is not found at the base ref |
| `--base <ref>` | Base ref for `--changed`, `--new`, and `ctx.changes`. Default `HEAD` |
| `--rule <id>` | Run only these rules. Repeatable |
| `--fail-on` | `error`, `warn`, or `never` |
| `--format` | `compact` or `json` |
| `--max-findings <n>` | Print at most n findings. Default 50 |
| `--config <path>` | Config file |

Scope reporting: a finding is shown if its location or any of its `related`
locations is in scope. Cycles that pass through a changed file are therefore
shown. Findings on the project are always in scope.

Compact output, one line per finding plus an optional hint line, no color when
not writing to a TTY:

```
src/features/calendar/hooks/useSlots.ts:12 error boundaries/entry-only Import src/features/booking through its entry file.
  hint: Export what you need from src/features/booking/index.ts and import that instead.
1 error, 0 warnings in 3 files (184 ms)
```

When more findings exist than `--max-findings`, the summary counts the rest per
rule so the agent can narrow the next run with `--rule` or a path.

## Describe

`archlint describe` turns the config into Markdown for the agent to read before
it writes code:

- Each element type with its pattern, entry files, description, and the
  current elements that match it
- What each element type may import, from `describe(options)` of the active
  boundary rules
- The conventions that apply, grouped by override and its description
- The changes that must happen together

`archlint describe <path>` shows only what applies to that path, for example a
new file the agent is about to create. The config is the single source for both
the checks and the description, so the documentation cannot drift from what is
enforced.

## Agent integration

Three layers, so the agent does not have to remember everything:

1. **Skill.** `packages/archlint/skills/archlint/SKILL.md` ships with the
   package. It tells the agent to:
   1. Run `archlint describe <path>` before creating files in an unfamiliar
      area.
   2. Run `archlint check --changed --new` after every change.
   3. Run `archlint rules explain <id>` for any finding it does not understand.
   4. Fix the code instead of disabling rules, editing the config, or adding
      suppression comments.
   5. Stop and ask a human on `archlint/config-changed`.
   6. Treat exit code 2 as a setup problem to report.
   7. Run the project's type check, lint, and tests as well, since archlint only
      checks structure.
2. **Agent hooks.** Documented examples run `archlint check --new <file>` after
   each edit in OpenCode and Claude Code. A dedicated `archlint hook` command is
   added only if the wrappers get complicated.
3. **Commit hooks and CI.** `archlint check --changed --new` in `vp staged` or
   another pre-commit tool, and `archlint check --base origin/main --new` in CI.

Rule-specific guidance comes from each rule's `meta.docs`, `describe`, and
`hint`, so the skill does not change when plugins are added.

## Official plugins in v1

### `@archlint/plugin-boundaries`

Selectors are element types, or `{ type, captures }` to match captured values.

| Rule | Purpose | Main options |
|---|---|---|
| `allowed-imports` | Which elements may import which | `rules: [{ from, allow?, disallow?, message? }]`, `default: 'allow' \| 'disallow'` |
| `entry-only` | Imports from outside an element must target its entry files | `elements` |
| `no-entry-import` | These imports must target files, not entry files (including imports of the element's own entry) | `rules: [{ from, to: selector \| 'self' }]` |
| `public-api` | An imported file must be reachable from the target element's entry through re-exports | `elements`, `from?` |
| `no-cycles` | No dependency cycles between elements | `elements` |
| `no-unresolved` | Imports must resolve | `ignore?` |
| `restricted-packages` | Packages or named imports that must not be used, optionally per element | `packages: [{ name, importNames?, allowTypeImports?, from?, message? }]` |
| `no-undeclared-dependency` | External imports must be declared in the nearest `package.json` | `allowDev?: glob[]` |
| `no-orphans` | Source files that nothing imports and that are not entries, tests, or listed roots | `roots: glob[]` |

### `@archlint/plugin-conventions`

| Rule | Purpose | Main options |
|---|---|---|
| `no-default-export` | Named exports only | none, scope with `overrides` |
| `file-name-case` | File naming | `case`, `ignore?` |
| `directory-case` | Directory naming | `case`, `ignore?` |
| `forbidden-files` | Disallow file names | `patterns: [{ name, message? }]` |
| `forbidden-directories` | Disallow directory names | `patterns: [{ name, message? }]` |
| `root-only-files` | Files allowed only at an element root | `names` |
| `file-name-pattern` | Files in a directory must match a pattern | `directory`, `pattern`, `message?` |
| `required-files` | Files that must exist in each element or directory | `files: [{ in, path, message? }]` |
| `companion-files` | A file requires a companion, for example `X.tsx` requires `X.test.tsx` | `rules: [{ files, requires, message? }]` |
| `export-matches-filename` | A file exports one value named after the file | `files`, `transform`, `allowDeprecated?` |
| `export-name-pattern` | Exported names in matching files follow a pattern, for example `use*` in `hooks/` | `rules: [{ files, pattern, message? }]` |
| `no-suppressions` | No `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `oxlint-disable`, or `biome-ignore` comments | `allow?` |

### `@archlint/plugin-changes`

| Rule | Purpose | Main options |
|---|---|---|
| `requires-change` | When files matching `when` change, a file matching `require` must change too | `rules: [{ when, require, hint? }]` |
| `no-manual-edit` | Files that must be regenerated, not edited by hand | `files`, `unless?` (files whose change allows it), `hint?` |

`requires-change` also covers checks such as "a changed package needs a
changeset": `{ when: 'packages/*/src/**', require: '.changeset/*.md' }`.

## Testing

`@archlint/core/testing` exports:

- `runRule(rule, { files, config?, options?, base?, changes? })`, which returns
  findings. `base` is a second file map for the base ref, and `changes` can be
  given directly for change rules.
- `testRule(rule, { valid, invalid })`, which generates Vitest cases

Fixtures are memory snapshots. They are written to a temporary directory so
tests use the real parser and resolver.

## Adoption in VGCS Queenbolt

Queenbolt gets an `archlint.config.ts` and a local plugin for rules that are
specific to it. Mapping from the current checks:

| Current check | archlint |
|---|---|
| `DEFAULT_EXPORT` | `conventions/no-default-export` in an override |
| `TYPES_FILE`, `COMPONENT_IN_INDEX` | `conventions/forbidden-files` |
| `TESTS_DIR_NAME`, `STORIES_DIR` | `conventions/forbidden-directories` |
| `DIRECTORY_CASE` | `conventions/directory-case` |
| `NESTED_FEATURE_BARREL`, `NESTED_COMMON_BARREL`, `NESTED_MESSAGES` | `conventions/root-only-files` |
| `UTIL_NAME` | `conventions/file-name-pattern` |
| `UTIL_EXPORTS` | `conventions/export-matches-filename` |
| `DEEP_FEATURE_IMPORT` | `boundaries/entry-only` |
| `SELF_FEATURE_BARREL`, `COMMON_ROOT_IMPORT`, `API_COMMON_ROOT` | `boundaries/no-entry-import` |
| `PRIVATE_COMMON_IMPORT` | `boundaries/public-api` |
| `SHARED_TO_FEATURE`, `FEATURE_AGGREGATOR_IMPORT` | `boundaries/allowed-imports` |
| `FEATURE_CYCLE`, `COMMON_CYCLE` | `boundaries/no-cycles` |
| `UNRESOLVED_IMPORT` | `boundaries/no-unresolved` |
| `BUCKET_NAME` | Local plugin rule |
| `check translation` (CLI) | `changes/requires-change` |
| Hand edits in `src/generated/` | `changes/no-manual-edit` |
| Imports of `@dealerrelations/ui-components` | `boundaries/restricted-packages` |

Adoption is done when archlint reports the same findings as
`pnpm check:architecture` on Queenbolt, and the existing script and its skill
references are replaced.

## Milestones

1. **Scaffold:** pnpm workspace, Vite+ (`vp check`, `vp test`, `vp pack`,
   `vp run`, `vp staged`), Changesets, CI.
2. **Core:** snapshots, project tiers, elements, packages, oxc parsing and
   resolution, git changes, rule runner, finding identity, config resolution
   and validation, severity, scope, core findings, testing helpers.
3. **CLI:** `check` with all flags including `--new`, `describe`,
   `rules list`, `rules explain`, reporters, exit codes, performance budget in
   CI.
4. **plugin-boundaries**
5. **plugin-conventions**
6. **plugin-changes**
7. **Skill, agent hook examples, docs, and examples:** both example projects
   pass end-to-end tests.
8. **Queenbolt adoption:** local plugin, parity with the current script.
9. **First release:** final name and npm scope decided.

## Open questions

- Final package name and npm scope, and whether to publish publicly or to an
  internal registry
- Whether files should belong to more than one element (tags)
- Capture templates in selectors, for example "a slice may only import lower
  layers"
- Whether `no-cycles` should also support file-level cycles inside an element
- Whether `archlint/config-changed` should be able to fail a run, or only be
  reported
