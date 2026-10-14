# archlint plan

`archlint` is a working name. The unscoped npm name is taken by an abandoned
package, so the final name is decided before the first release.

## Goal

A fast, structure-agnostic architecture checker for TypeScript projects. One
config file describes the whole structure of a codebase: which parts exist, how
they may depend on each other, and how files and directories are named and
shaped. An AI agent runs the CLI right after each change and gets a short,
actionable list of findings.

## Principles

- **Agnostic core.** The core knows nothing about features, layers, or any
  folder layout. Structure comes from user config; rules come from plugins.
- **One config owns structure.** Rules that overlap with a linter (for example
  `no-default-export`) are still in scope. The point is that one command and one
  config cover everything an agent must follow.
- **Fast enough to run after every change.** Work is done lazily and limited to
  what the active rules need.
- **TypeScript first.** Configs, rules, and plugins are written in TypeScript,
  and rule ids and options are type-checked in the config.
- **Built for agents.** Compact output, stable rule ids, a `rules explain`
  command, and a skill that ships with the package.

## Non-goals for v1

- Editor integration (LSP, ESLint or oxlint adapter)
- Autofix
- Type-aware rules (no type checker is run)
- Persistent cache between runs
- Baselines and inline suppression comments

Each of these can be added later without breaking the rule API.

## Decisions

### A standalone tool, not an ESLint plugin

ESLint checks one file at a time. The most valuable architecture rules need the
whole project: dependency cycles, whether a file is reachable from an
element's public entry, and rules about directories. In ESLint these need
module-level caches that break with `--cache` and in editors. Many target
projects also use a linter other than ESLint (Biome, Oxlint), and adding a
second linter only for architecture rules is a cost. A standalone CLI also
controls its own output, scoping, and exit codes, which matters for agents.

The rule API borrows from ESLint where it fits (`create` with visitors, `meta`,
plugins with `configs`, `overrides`) so it feels familiar.

### Elements with captured path segments

Structure is described with element patterns such as `src/features/:name`.
Alternatives considered:

| Model | Why not |
|---|---|
| No elements, paths only | Every plugin would parse paths itself, and generic rules such as cycles between groups could not be shared |
| Tags, several per file (as in Sheriff or Nx) | More flexible but harder to reason about, and every rule must handle sets of tags. Can be added on top of elements later |

### Two official plugins

Plugins are split by the question they answer:

- `boundaries`: may this part of the code depend on that part? Needs elements
  and the import graph. The name follows the established term "module
  boundaries" (Nx, Sheriff, eslint-plugin-boundaries).
- `conventions`: does this file or directory look right? Works without
  elements.

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

## Repository

Monorepo using pnpm workspaces and Vite+.

```
archlint/
  packages/
    core/                 @archlint/core
    archlint/             archlint (CLI and main entry point)
    plugin-boundaries/    @archlint/plugin-boundaries
    plugin-conventions/   @archlint/plugin-conventions
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

Kept small and chosen for startup time. Oxc and unjs are preferred.

| Need | Package | Used in |
|---|---|---|
| Parsing | `oxc-parser` | core |
| Module resolution | `oxc-resolver` | core |
| Path handling with `/` on all platforms | `pathe` (unjs) | core |
| File discovery | `tinyglobby` | core |
| Glob matching for `overrides` and `ignore` | `picomatch` | core |
| CLI commands | `citty` (unjs) | archlint |
| Config loading | `c12` (unjs) | archlint |
| Colors | `node:util` `styleText` | archlint |
| Running git | `node:child_process` | archlint |

All packages are ESM only and target the current Node LTS.

## Packages

| Package | Contents | Used by |
|---|---|---|
| `@archlint/core` | Engine, project model, elements, parsing and resolution, config resolution, `defineRule`, `definePlugin`, `defineConfig`, types. `@archlint/core/testing` exports the rule test helpers. No CLI code. | Plugin authors (as a peer dependency), the CLI |
| `archlint` | citty CLI, config loading, git integration, reporters, agent skill. Re-exports `defineConfig` and the public types from core so users install one package. | Everyone using the tool |
| `@archlint/plugin-boundaries` | Rules about dependencies between elements | Projects that define elements |
| `@archlint/plugin-conventions` | Rules about file and directory names, placement, and export shape | Any project |

Project-specific rules do not live in this repo. For example, the VGCS
Queenbolt rules live in Queenbolt as a local plugin.

### Naming conventions

- Official plugins: `@archlint/plugin-<name>`
- Community plugins: `archlint-plugin-<name>` or `@scope/archlint-plugin-<name>`
- Shareable configs without rules: `archlint-config-<name>`
- Plugins declare `@archlint/core` as a peer dependency

## Core concepts

### Project model

The engine builds the project model in three tiers and only builds a tier when
an active rule needs it.

| Tier | Data | Source | Built for |
|---|---|---|---|
| 1. Paths | Files, directories, element membership, test flag | glob | All files in `include` |
| 2. Module info | Imports, re-exports, dynamic imports, export names | `oxc-parser` module record, without materializing the AST | Files in scope, or all files when a project rule is active |
| 3. AST | ESTree program and comments | `oxc-parser` program (lazy) | Files in scope only |

Imports are resolved with `oxc-resolver`, which reads `tsconfig.json` paths and
follows workspace symlinks. Every specifier is resolved, not only relative ones.
An edge that resolves inside the project is internal, an edge into
`node_modules` is external and keeps the package name, and an edge that cannot
be resolved is marked unresolved.

`include`, `ignore`, and `tests` globs in the config decide which files exist
and which are test files. Test files are part of the project model, and each
rule decides whether to check them.

### Elements

Elements map parts of the file tree to named architectural units. They are
optional. Projects without elements can still use path, module, and AST rules.

```ts
elements: [
  { type: 'feature', pattern: 'src/features/:name', entry: 'index.ts' },
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
  used by `entry-only` and `public-api`.

Each file and directory gets:

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
  create: (ctx) => ({
    import(edge) {
      const { from, to } = edge;
      if (
        to?.element &&
        ctx.options.elements.includes(to.element.type) &&
        from.element?.id !== to.element.id &&
        !to.element.isEntry
      ) {
        ctx.report({ at: edge, message: `Import ${to.element.root} through its entry file.` });
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
- `ctx.report({ at, message, related? })` reports a finding. `at` is a file, a
  directory, an import edge, or `{ file, line, column }`. `related` lists other
  locations, such as the edges of a cycle.

Visitors decide which project tiers are built:

| Visitor | Receives | Needs tier | Runs for |
|---|---|---|---|
| `file` | File facts | 1 | Files in scope |
| `directory` | Directory facts | 1 | Directories in scope |
| `module` | File and its module info | 2 | Files in scope |
| `import` | Resolved import edge | 2 + resolution | Edges from files in scope |
| `ast` | File and ESTree program | 3 | Files in scope |
| `project` | Whole project graph | 2 + resolution for all files | Once per run |

If no active rule uses `module`, `import`, `ast`, or `project`, no file is read.

A shorthand covers the common "condition plus message" case:

```ts
export const typesFile = defineFileRule({
  meta: { description: 'No types.ts files.', severity: 'warn' },
  when: (file) => file.name === 'types.ts',
  message: 'Move these types to named files in models/.',
});
```

`defineDirectoryRule` works the same way.

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
import conventions from '@archlint/plugin-conventions';
import local from './archlint/plugin';

export default defineConfig({
  include: ['src/**/*.{ts,tsx}'],
  ignore: ['src/generated/**'],
  tests: ['**/*.test.{ts,tsx}', '**/tests/**'],
  failOn: 'error',
  elements: [
    { type: 'feature', pattern: 'src/features/:name' },
    { type: 'domain', pattern: 'src/common/:name' },
  ],
  plugins: [boundaries, conventions, local],
  extends: [boundaries.configs.recommended],
  rules: {
    'conventions/directory-case': ['error', { case: 'kebab' }],
    'boundaries/entry-only': ['error', { elements: ['feature'] }],
  },
  overrides: [
    {
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
- `overrides` select locations with `files`, `ignore`, and `elements`. Rules
  never implement their own scoping.
- Resolution order: `extends` in order, then top-level `rules`, then
  `overrides` in order. The last match wins.
- Each finding is checked against the config that applies at its location.
  The rule must be enabled there, and the level used is the level set there. A
  rule configured with different options in different places runs once per
  distinct options set.
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

How:

- The CLI ships as prebuilt ESM. No `tsx` at runtime.
- Subcommands are lazy imports, as in the Queenbolt CLI.
- Tiers are built only when an active rule needs them, and ASTs only for files
  in scope.
- `check <paths>` and `--changed` limit reporting. The full graph is built
  only when a `project` rule is active.
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
        rules/
          index.ts          # command group
          commands/
            list.ts         # archlint rules list
            explain.ts      # archlint rules explain <id>
      utils/
        configUtil.ts       # config loading and validation
        gitUtil.ts          # changed files
    reporters/
      compactReporter.ts
      jsonReporter.ts
    index.ts                # re-exports defineConfig and public types
  skills/
    archlint/SKILL.md
```

Commands:

```bash
archlint check [paths...]          # report findings in these files or directories
archlint check --changed           # files changed against HEAD, plus untracked files
archlint check --rule boundaries/no-cycles
archlint check --fail-on never --format json
archlint rules list                # active rules, level, and source plugin or config
archlint rules explain <rule-id>   # description and docs for one rule
```

Flags on `check`: `--changed`, `--rule <id>` (repeatable), `--fail-on`,
`--format compact|json`, `--config <path>`.

Scope reporting: a finding is shown if its location or any of its `related`
locations is in scope. Cycles that pass through a changed file are therefore
shown.

Compact output, one line per finding, no color when not writing to a TTY:

```
src/features/calendar/hooks/useSlots.ts:12 error boundaries/entry-only Import src/features/booking through its entry file.
1 error, 0 warnings in 3 files (184 ms)
```

## Agent skill

`packages/archlint/skills/archlint/SKILL.md` ships with the package. It is
generic and tells the agent to:

1. Run `archlint check --changed` after every change.
2. Run `archlint rules explain <id>` for any finding it does not understand.
3. Fix the code instead of disabling rules or editing the config.
4. Treat exit code 2 as a setup problem to report, not something to work around.

Rule-specific guidance comes from each rule's `meta.docs`, so the skill does
not change when plugins are added.

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
| `export-matches-filename` | A file exports one value named after the file | `files`, `transform`, `allowDeprecated?` |

## Testing

`@archlint/core/testing` exports:

- `runRule(rule, { files, config?, options? })`, which returns findings
- `testRule(rule, { valid, invalid })`, which generates Vitest cases

Fixtures are given as a map of path to content. They are written to a
temporary directory so tests use the real parser and resolver.

## Adoption in VGCS Queenbolt

Queenbolt gets an `archlint.config.ts` and a local plugin for rules that are
specific to it. Mapping from the current `scripts/architecture*.ts` warning
codes:

| Current code | archlint |
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

Adoption is done when archlint reports the same findings as
`pnpm check:architecture` on Queenbolt, and the existing script and its skill
references are replaced.

## Milestones

1. **Scaffold:** pnpm workspace, Vite+ (`vp check`, `vp test`, `vp pack`,
   `vp run`, `vp staged`), Changesets, CI.
2. **Core:** project tiers, elements, oxc parsing and resolution, rule runner,
   config resolution and validation, severity, scope, testing helpers.
3. **CLI:** `check`, `rules list`, `rules explain`, reporters, `--changed`,
   exit codes, performance budget in CI.
4. **plugin-boundaries**
5. **plugin-conventions**
6. **Skill, docs, and examples:** both example projects pass end-to-end tests.
7. **Queenbolt adoption:** local plugin, parity with the current script.
8. **First release:** final name and npm scope decided.

## Open questions

- Final package name and npm scope, and whether to publish publicly or to an
  internal registry
- Whether files should belong to more than one element (tags)
- Capture templates in selectors, for example "a slice may only import lower
  layers"
- Rules on external packages, for example "only `shared` may import
  `@mui/material`"
- Whether `no-cycles` should also support file-level cycles inside an element
