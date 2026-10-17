# pilotlint

[![npm](https://img.shields.io/npm/v/pilotlint)](https://www.npmjs.com/package/pilotlint)
[![license](https://img.shields.io/npm/l/pilotlint)](LICENSE)

### Steer your AI agent to the architecture you want.

Coding agents write code that works and put it in the wrong place. pilotlint lets you write
down how your project is structured, once, and checks every change against it. The agent gets
a short, precise report after each edit and fixes its own mistakes before you ever see them.

```
$ pilotlint check --changed --new
src/features/calendar/hooks/useSlots.ts:1 error boundaries/entry-only Import src/features/booking through its entry file, not src/features/booking/components/bookingPage.ts.
  hint: Export what you need from src/features/booking/index.ts and import it from there.
1 error, 0 warnings in 1 file, new since HEAD (92 ms)
```

## Let your agent set it up

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

Prefer to do it yourself? **[Get started →](docs/getting-started.md)**

## The problem

You ask an agent for a feature. It works, the tests pass, and then you review it:

- A feature reaches into another feature's internals instead of its public API.
- Shared code imports from a feature, and now everything depends on everything.
- A new `helpers.ts` appears next to the `utils/` folder you already have.
- A `@ts-ignore` makes the type error go away.
- A generated file was edited by hand, and the next codegen run erases the change.

Rules in `AGENTS.md` help, but they are suggestions. The agent forgets them in a long session,
and you find out in review. Every round of "please move this" costs you time and tokens.

## How pilotlint fixes it

1. **You describe the structure once.** The parts of your codebase, what may import what, how
   files are named, and which files must change together, in one typed config.
2. **The agent reads it before writing.** `pilotlint describe src/features/calendar` explains
   what applies to a path, even one that does not exist yet.
3. **Every edit is checked.** A hook runs `pilotlint check --new` after each change. The agent
   only sees the problems it just caused, each with a hint that says how to fix it.
4. **The agent fixes the code, not the rules.** There are no comments that switch off a
   finding. Only the config can do that, and pilotlint flags every change to the config for a
   human to review.

## What you can enforce

```ts
// pilotlint.config.ts
import boundaries from '@pilotlint/plugin-boundaries';
import conventions from '@pilotlint/plugin-conventions';
import { defineConfig } from 'pilotlint';

export default defineConfig({
  elements: [
    { type: 'feature', pattern: 'src/features/:name', description: 'A user-facing feature.' },
    { type: 'domain', pattern: 'src/common/:name', description: 'Shared business logic.' },
  ],
  extends: [boundaries.configs.recommended, conventions.configs.recommended],
  rules: {
    // Features are used through their index.ts, never their internals.
    'boundaries/entry-only': ['error', { elements: 'feature' }],
    // Shared code never depends on features.
    'boundaries/allowed-imports': ['error', { rules: [{ from: 'domain', disallow: 'feature' }] }],
    // Utils live in utils/ and are named *Util.ts.
    'conventions/file-name-pattern': [
      'error',
      { rules: [{ directory: 'utils', pattern: '*Util.ts' }] },
    ],
  },
});
```

- **Boundaries:** which parts may import which, entry files and public APIs, cycles, unresolved
  imports, undeclared dependencies, and banned packages or globals such as `fetch` in pure
  code. [Rules →](docs/rules/boundaries.md)
- **Conventions:** file and directory names, where files go, required files such as a test
  next to each component, export names, and no `@ts-ignore` or `eslint-disable`.
  [Rules →](docs/rules/conventions.md)
- **Changes:** files that must change together, such as translations with their messages, and
  generated files that must not be edited by hand. [Rules →](docs/rules/changes.md)
- **Presets:** Feature-Sliced Design, Bulletproof React, monorepos, Clean Architecture, and
  layered backends, each in one line. [Presets →](docs/presets/README.md)
- **Your own rules:** a local plugin for what only your project needs.
  [Writing rules →](docs/writing-rules.md)

## Why pilotlint

**Made for agents.** Findings are one line with a hint. `--new` hides everything that was
already there, so an agent working in a legacy codebase only sees its own mess. Exit codes
tell "the code breaks a rule" (`1`) from "pilotlint could not run" (`2`). An agent skill ships
in the package.

**Fast enough to run after every edit.** pilotlint is built on [Oxc](https://oxc.rs), the
parser and resolver written in Rust. On a real project with 1,053 files, Oxc collected every
import in 60 ms, where the TypeScript compiler API took 260 ms. A full check of 1,000 files
takes a few hundred milliseconds, and pilotlint only reads and parses what your rules need.

**Fits your structure, not ours.** Feature folders, Feature-Sliced Design, layers, or a
monorepo with `packages/:name`: you define the parts of your architecture with patterns, and
every rule works with them.

**Familiar if you know ESLint.** Rules have `meta` and `create` with visitors, plugins ship
`recommended` configs, levels are `'off'`, `'warn'`, and `'error'`, and overrides target
files. Rules see the same ESTree AST as ESLint and typescript-eslint, and you test them with
`valid` and `invalid` cases, like `RuleTester`.

**Works next to your linter.** ESLint checks one file at a time, and architecture needs the
whole project: cycles, public APIs, and files that change together. pilotlint is its own small
CLI, so it runs beside ESLint, Oxlint, or Biome without replacing them.

**Typed config.** Rule ids and options are checked by TypeScript as you write the config.

## Quick start

```bash
npm install -D pilotlint @pilotlint/plugin-boundaries @pilotlint/plugin-conventions
```

Add a `pilotlint.config.ts` like the one above. If your project follows a well-known
architecture, start from a [preset](docs/presets/README.md) instead:

```ts
extends: [boundaries.configs.recommended, featureSliced()],
```

Then run:

```bash
npx pilotlint check
```

Give your agent the skill in `node_modules/pilotlint/skills/pilotlint/SKILL.md`, and add a
hook that runs pilotlint after each edit. [Set up your agent →](docs/agents.md)

## Docs

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

## Development

The repository uses [Vite+](https://viteplus.dev) and pnpm:

```bash
pnpm install
pnpm ready         # format, lint, type check, test, and check this repository with pilotlint
pnpm docs:rules    # update docs/rules
pnpm changeset     # describe a change for the changelog
```

[RELEASE.md](RELEASE.md) describes how to release to npm, and [PLAN.md](PLAN.md) the design
and the decisions behind it.

## License

[MIT](LICENSE)
