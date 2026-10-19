<p align="center">
  <img src="assets/logo.svg" width="96" height="96" alt="pilotlint logo">
</p>

<h1 align="center">pilotlint</h1>

<p align="center">
  An architecture linter for TypeScript, built for coding agents.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/pilotlint"><img src="https://img.shields.io/npm/v/pilotlint" alt="npm version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/npm/l/pilotlint" alt="MIT license"></a>
</p>

<p align="center">
  <a href="docs/getting-started.md"><b>Docs</b></a> |
  <a href="docs/rules/README.md"><b>Rules</b></a> |
  <a href="docs/presets/README.md"><b>Presets</b></a>
</p>

<p align="center">
  <img src="assets/demo.svg" alt="An agent writes a file that imports another feature. The pilotlint hook reports the broken boundary with a hint. The agent moves the import to the app route, and the next check passes.">
</p>

<p align="center">
  <i>An agent breaks a boundary, reads the hint, and fixes it before you review.</i>
</p>

- 🤖 Built for agents: one finding per line, each with a hint that says how to fix it
- 🛤️ Keeps agents in their lane: the same rules on every edit, however small the task or long
  the session
- 🎯 `--new` reports only what the current change broke, even in a codebase full of old problems
- ⚡️ Built on [Oxc](https://oxc.rs), the Rust parser and resolver, so it can run after every edit
- 📦 Built-in caching, so a check after an edit parses only the files that changed
- 🏗️ [Presets](docs/presets/README.md) for Feature-Sliced Design, Bulletproof React, Clean
  Architecture, layered backends, and monorepos
- 🧭 Works with any structure: you name the parts of your codebase with path patterns
- 📏 [29 built-in rules](docs/rules/README.md) for imports, cycles, public APIs, file names, and
  files that change together
- 🔒 No suppression comments: only the config can turn a finding off, and every config change is
  flagged for a human to review
- 🤝 Runs next to ESLint, Oxlint, or Biome instead of replacing them
- 🛠️ Typed config: TypeScript checks rule ids and options as you write them
- 🧩 [Custom rules](docs/writing-rules.md) for your own architecture and conventions take a
  few lines of TypeScript, with an API that works like ESLint's

Coding agents write code that works and put it in the wrong place. A feature reaches into
another feature's internals, shared code imports from a feature, and a new `helpers.ts` shows
up next to the `utils/` folder you already have.

It happens because an agent only knows the structure it can see. With a small task, it sees a
few files and guesses the rest of the layout. With a big task or a long session, the rules in
`AGENTS.md` scroll out of its context and get dropped. Either way, it drifts from the structure
you expect, a little more with every change.

pilotlint keeps it in its lane. The rules live in a config instead of a prompt, and a check
runs after every edit, so the agent gets the same answer at the start of a session and three
hours in, on a one-line fix and on a new feature. It fixes its own mistakes, and you review
code that is already in the right place.

## Before and after

One example of what pilotlint can enforce. The "after" side is not built in: it is a
structure and a set of conventions picked for this demo, and you write the rules for your
own. Any layout and any naming scheme work, from your own folder names to `snake_case` files
or a different util style.

<p align="center">
  <img src="assets/before-after-structure.svg" alt="Before: a src folder where features are mixed into components, with helpers, api.ts, types.ts, and utils.ts at the top. After: a Bulletproof React structure with app, one folder per feature, shared components and lib, and utils split by topic.">
</p>

<p align="center">
  <img src="assets/before-after-utils.svg" alt="Before: src/utils.ts with loose date and price functions and a default export. After: src/utils/dateUtil.ts with only date functions, exported as one DateUtil object.">
</p>

These are the settings for this demo: the Bulletproof React preset, plus naming rules chosen
for it. The [example project](examples/bulletproof-react) has the structure on the right, and a
test checks that this config catches every problem on the left:

```ts
// pilotlint.config.ts
export default defineConfig({
  plugins: [conventions],
  extends: [boundaries.configs.recommended, bulletproofReact()],
  rules: {
    // No catch-all files or folders.
    'conventions/forbidden-files': ['error', { patterns: [{ name: '{utils,helpers,types}.ts' }] }],
    'conventions/forbidden-directories': ['error', { patterns: [{ name: 'helpers' }] }],
    // Utils are split by topic into <topic>Util.ts files.
    'conventions/file-name-pattern': [
      'error',
      { rules: [{ directory: 'utils', pattern: '*Util.ts' }] },
    ],
    'conventions/no-default-export': 'error',
  },
  overrides: [
    // dateUtil.ts exports one DateUtil object, and nothing else.
    { files: ['src/**/utils/*Util.ts'], rules: { 'conventions/export-matches-filename': 'error' } },
  ],
});
```

Every part of this is a choice. Use [another preset](docs/presets/README.md) or
[describe your own structure](docs/configuration.md#elements), and pick the
[rules](docs/rules/README.md) and options that match how your team works.

## Getting started

For more, see the [documentation](docs/getting-started.md).

### Installation

```bash
npm install -D pilotlint @pilotlint/plugin-boundaries @pilotlint/presets
```

### Configuration

If your project follows a well-known architecture, the config is one line:

```ts
// pilotlint.config.ts
import boundaries from '@pilotlint/plugin-boundaries';
import { bulletproofReact } from '@pilotlint/presets';
import { defineConfig } from 'pilotlint';

export default defineConfig({
  extends: [boundaries.configs.recommended, bulletproofReact()],
});
```

Or describe your own structure. Elements are the parts of your codebase, and rules say how
they may use each other:

```ts
// pilotlint.config.ts
import boundaries from '@pilotlint/plugin-boundaries';
import { defineConfig } from 'pilotlint';

export default defineConfig({
  elements: [
    { type: 'feature', pattern: 'src/features/:name', description: 'A user-facing feature.' },
    { type: 'domain', pattern: 'src/common/:name', description: 'Shared business logic.' },
  ],
  extends: [boundaries.configs.recommended],
  rules: {
    // Features are used through their index.ts, never their internals.
    'boundaries/entry-only': ['error', { elements: 'feature' }],
    // Shared code never depends on features.
    'boundaries/allowed-imports': ['error', { rules: [{ from: 'domain', disallow: 'feature' }] }],
  },
});
```

See [configuration](docs/configuration.md) for every field.

### Usage

```bash
npx pilotlint check                    # Check the whole project.
npx pilotlint check --changed --new    # Report only what the current change broke.
npx pilotlint describe src/features    # Explain what applies to a path, even a new one.
```

Exit code `1` means findings, and `2` means pilotlint could not run. See the [CLI](docs/cli.md).

### Connect your agent

1. Copy the skill in `node_modules/pilotlint/skills/pilotlint/SKILL.md` into your agent's
   skills directory. It tells the agent to read the structure before it writes, and to fix
   the code rather than the config.
2. Add a hook that runs `pilotlint check --new` after each edit, so the agent never has to
   remember it.

[Set up your agent →](docs/agents.md) has hooks for Claude Code and OpenCode, and a check for
commits and CI.

<details>
<summary><b>Or let your agent set it all up</b></summary>

Copy this prompt into your coding agent, in your own repository:

```text
Set up pilotlint (https://github.com/banjo/pilotlint) in this repository, so you and other
agents get feedback when a change breaks the project structure.

1. Read these docs first:
   https://raw.githubusercontent.com/banjo/pilotlint/main/docs/getting-started.md
   https://raw.githubusercontent.com/banjo/pilotlint/main/docs/configuration.md
   https://raw.githubusercontent.com/banjo/pilotlint/main/docs/rules/README.md
   https://raw.githubusercontent.com/banjo/pilotlint/main/docs/presets/README.md
   https://raw.githubusercontent.com/banjo/pilotlint/main/docs/agents.md
2. Install pilotlint, @pilotlint/plugin-boundaries, and @pilotlint/plugin-conventions as dev
   dependencies with this project's package manager.
3. Study the project and write pilotlint.config.ts that describes its structure as it is
   today: elements for the main parts, with a description each, which parts may import which,
   and the naming conventions the code already follows. If the project follows an
   architecture that has a preset, install @pilotlint/presets and start from that preset.
4. Run `npx pilotlint check`. When existing code breaks a rule many times, set that rule to
   'warn' instead of changing the code.
5. Copy node_modules/pilotlint/skills/pilotlint/SKILL.md into this repository's skills
   directory for agents.
6. Do not change any other code. Show me the config and explain each rule, so I can review it.
```

</details>

## What it catches

| The agent...                                                  | Caught by                                                                                  |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Imports another feature's internals instead of its public API | [`boundaries/entry-only`](docs/rules/boundaries.md#entry-only)                             |
| Makes shared code import from a feature                       | [`boundaries/allowed-imports`](docs/rules/boundaries.md#allowed-imports)                   |
| Makes two parts depend on each other                          | [`boundaries/no-cycles`](docs/rules/boundaries.md#no-cycles)                               |
| Imports deep into another workspace package                   | [`boundaries/workspace-imports`](docs/rules/boundaries.md#workspace-imports)               |
| Imports a package that is not in `package.json`               | [`boundaries/no-undeclared-dependency`](docs/rules/boundaries.md#no-undeclared-dependency) |
| Calls `fetch` or reads `process.env` in code meant to be pure | [`boundaries/restricted-globals`](docs/rules/boundaries.md#restricted-globals)             |
| Adds a `helpers/` folder next to your `utils/`                | [`conventions/forbidden-directories`](docs/rules/conventions.md#forbidden-directories)     |
| Names a file in a way your project doesn't                    | [`conventions/file-name-pattern`](docs/rules/conventions.md#file-name-pattern)             |
| Adds a component without its test                             | [`conventions/companion-files`](docs/rules/conventions.md#companion-files)                 |
| Adds `@ts-ignore` or `eslint-disable` to hide an error        | [`conventions/no-suppressions`](docs/rules/conventions.md#no-suppressions)                 |
| Adds a message without its translations                       | [`changes/requires-change`](docs/rules/changes.md#requires-change)                         |
| Edits a generated file by hand                                | [`changes/no-manual-edit`](docs/rules/changes.md#no-manual-edit)                           |
| Edits the pilotlint config to make a finding go away          | [`pilotlint/config-changed`](docs/rules/pilotlint.md#config-changed)                       |

## Why not an ESLint plugin?

pilotlint could have been a set of ESLint rules, like
[eslint-plugin-boundaries](https://github.com/javierbrea/eslint-plugin-boundaries). An ESLint
plugin would have:

- ✅ No new tool, for the many projects that already run ESLint
- ✅ Errors in the editor as you type
- ✅ ESLint's configs, integrations, and ecosystem

But ESLint is built to check one file at a time, and architecture rules need more:

- ❌ Cycles, public APIs, and unused files need the whole import graph. ESLint rules can only
  build it with caches of their own, which break in editors and with `--cache`.
- ❌ ESLint does not check directories, files that must exist, or files that change together.
- ❌ ESLint cannot report only what a change broke. pilotlint's `--new` compares with git, so an
  agent sees its own mistakes, not the ones that were already there.
- ❌ `// eslint-disable` lets an agent switch a rule off in the code. pilotlint has no
  suppression comments, and flags every config change for review.
- ❌ Many projects now lint with Biome or Oxlint, and would install ESLint only for this.

So pilotlint is its own tool. It is built on [Oxc](https://oxc.rs) and keeps imports between
runs, so it is fast enough to run after every edit. The cost is one more tool and config file,
and no editor integration yet. Writing a rule still feels like ESLint: `create`, visitors,
`meta`, and `report` work the same way ([Writing rules](docs/writing-rules.md#coming-from-eslint)).

## Documentation

- [Getting started](docs/getting-started.md): install, write a first config, and run a check
- [Concepts](docs/concepts.md): elements, findings, levels, and changes
- [Configuration](docs/configuration.md): every field of the config
- [CLI](docs/cli.md): commands, flags, and exit codes
- [Rules](docs/rules/README.md): what each rule checks, with its options
- [Presets](docs/presets/README.md): ready-made configs for well-known architectures
- [Agents](docs/agents.md): the skill and hooks for coding agents
- [Writing rules](docs/writing-rules.md): local plugins and publishing your own

## Packages

| Package                                                        | Version                                                                                                                           | Contents                                      |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| [`pilotlint`](packages/pilotlint)                              | [![npm](https://img.shields.io/npm/v/pilotlint)](https://www.npmjs.com/package/pilotlint)                                         | The CLI, `defineConfig`, and the agent skill  |
| [`@pilotlint/plugin-boundaries`](packages/plugin-boundaries)   | [![npm](https://img.shields.io/npm/v/@pilotlint/plugin-boundaries)](https://www.npmjs.com/package/@pilotlint/plugin-boundaries)   | Imports between parts, packages, and globals  |
| [`@pilotlint/plugin-conventions`](packages/plugin-conventions) | [![npm](https://img.shields.io/npm/v/@pilotlint/plugin-conventions)](https://www.npmjs.com/package/@pilotlint/plugin-conventions) | Names, placement, required files, and exports |
| [`@pilotlint/plugin-changes`](packages/plugin-changes)         | [![npm](https://img.shields.io/npm/v/@pilotlint/plugin-changes)](https://www.npmjs.com/package/@pilotlint/plugin-changes)         | Files that must change together               |
| [`@pilotlint/presets`](packages/presets)                       | [![npm](https://img.shields.io/npm/v/@pilotlint/presets)](https://www.npmjs.com/package/@pilotlint/presets)                       | Presets for well-known architectures          |
| [`@pilotlint/core`](packages/core)                             | [![npm](https://img.shields.io/npm/v/@pilotlint/core)](https://www.npmjs.com/package/@pilotlint/core)                             | The engine and rule API, for plugin authors   |

## Contributing

The repository uses [Vite+](https://viteplus.dev) and pnpm:

```bash
pnpm install
pnpm ready         # format, lint, type check, test, and check this repository with pilotlint
pnpm docs:rules    # update docs/rules
pnpm bench         # time checks on a generated project of about 1,000 files
pnpm changeset     # describe a change for the changelog
```

[RELEASE.md](RELEASE.md) describes how to release to npm, and [PLAN.md](PLAN.md) the design
and the decisions behind it.

## License

[MIT](LICENSE)
