# pilotlint

pilotlint keeps coding agents on course. It is a fast architecture linter for TypeScript
projects, built for code written by AI agents.

One config file describes the structure of a codebase: which parts exist, how they may
depend on each other, how files and directories are named, and which files must change
together. An agent reads the structure before it writes code, runs `pilotlint check` after
each change, and gets a short list of the problems it introduced.

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
  plugins: [boundaries, conventions],
  extends: [boundaries.configs.recommended, conventions.configs.recommended],
  rules: {
    'boundaries/entry-only': ['error', { elements: 'feature' }],
    'boundaries/allowed-imports': ['error', { rules: [{ from: 'domain', disallow: 'feature' }] }],
    'conventions/directory-case': ['error', { case: 'kebab' }],
  },
});
```

```
$ pilotlint check --changed --new
src/features/calendar/hooks/useSlots.ts:1 error boundaries/entry-only Import src/features/booking through its entry file, not src/features/booking/components/bookingPage.ts.
  hint: Export what you need from src/features/booking/index.ts and import it from there.
1 error, 0 warnings in 1 file, new since HEAD (92 ms)
```

Elements come from your config, so pilotlint fits any layout: feature folders,
Feature-Sliced Design, or a monorepo with `packages/:name`.

## Quick start

```bash
pnpm add -D pilotlint @pilotlint/plugin-boundaries @pilotlint/plugin-conventions
npx pilotlint check
```

Then give your agent the skill in `node_modules/pilotlint/skills/pilotlint/SKILL.md`.

## Docs

| Page                                       | Read it to                                               |
| ------------------------------------------ | -------------------------------------------------------- |
| [Getting started](docs/getting-started.md) | Install pilotlint, write a first config, and run a check |
| [Concepts](docs/concepts.md)               | Understand elements, findings, levels, and changes       |
| [Configuration](docs/configuration.md)     | Look up a field of the config                            |
| [CLI](docs/cli.md)                         | Look up a command, a flag, or an exit code               |
| [Rules](docs/rules/README.md)              | See what each rule checks and its options                |
| [Agents](docs/agents.md)                   | Set up the skill and hooks for coding agents             |
| [Writing rules](docs/writing-rules.md)     | Write a local plugin or publish one                      |

## Packages

| Package                                                        | Contents                                                                                |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| [`pilotlint`](packages/pilotlint)                              | The CLI, `defineConfig`, and the agent skill                                            |
| [`@pilotlint/plugin-boundaries`](packages/plugin-boundaries)   | [Rules](docs/rules/boundaries.md) about imports between elements, packages, and globals |
| [`@pilotlint/plugin-conventions`](packages/plugin-conventions) | [Rules](docs/rules/conventions.md) about names, placement, required files, and exports  |
| [`@pilotlint/plugin-changes`](packages/plugin-changes)         | [Rules](docs/rules/changes.md) about files that must change together                    |
| [`@pilotlint/core`](packages/core)                             | The engine and rule API, for plugin authors                                             |

## Development

The repository uses [Vite+](https://viteplus.dev):

```bash
pnpm install
vp check                     # format, lint, and type check
vp run -r test               # tests in every package
vp run -r build              # build every package
pnpm pilotlint               # check this repository with pilotlint
pnpm docs:rules              # update docs/rules
pnpm changeset               # describe a change for the changelog
```

[PLAN.md](PLAN.md) has the design and the decisions behind it, and [RELEASE.md](RELEASE.md)
describes how to release new versions to npm.
