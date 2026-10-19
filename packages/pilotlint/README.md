<p align="center">
  <img src="https://raw.githubusercontent.com/banjo/pilotlint/main/assets/logo.svg" width="96" height="96" alt="pilotlint logo">
</p>

<h1 align="center">pilotlint</h1>

<p align="center">
  An architecture linter for TypeScript, built for coding agents.
</p>

<p align="center">
  <a href="https://github.com/banjo/pilotlint/blob/main/docs/getting-started.md"><b>Docs</b></a> |
  <a href="https://github.com/banjo/pilotlint/blob/main/docs/rules/README.md"><b>Rules</b></a> |
  <a href="https://github.com/banjo/pilotlint/blob/main/docs/presets/README.md"><b>Presets</b></a> |
  <a href="https://github.com/banjo/pilotlint"><b>GitHub</b></a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/banjo/pilotlint/main/assets/demo.svg" alt="An agent writes a file that imports another feature. The pilotlint hook reports the broken boundary with a hint. The agent moves the import to the app route, and the next check passes.">
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
- 🏗️ [Presets](https://github.com/banjo/pilotlint/blob/main/docs/presets/README.md) for
  Feature-Sliced Design, Bulletproof React, Clean Architecture, layered backends, and monorepos
- 🧭 Works with any structure: you name the parts of your codebase with path patterns
- 🔒 No suppression comments: only the config can turn a finding off
- 🤝 Runs next to ESLint, Oxlint, or Biome instead of replacing them

An agent only knows the structure it can see: on a small task it guesses the layout, and in a
long session the rules in `AGENTS.md` drop out of its context. pilotlint checks every edit
against the same config, so the agent stays on the structure you expect.

This package has the CLI, `defineConfig`, and the agent skill. The rules come from plugins, such
as [`@pilotlint/plugin-boundaries`](https://www.npmjs.com/package/@pilotlint/plugin-boundaries).

## Before and after

One example of what pilotlint can enforce. The "after" side is a structure and conventions
picked for this demo, not something built in: any layout and naming scheme can be configured.

<p align="center">
  <img src="https://raw.githubusercontent.com/banjo/pilotlint/main/assets/before-after-structure.svg" alt="Before: a src folder where features are mixed into components, with helpers, api.ts, types.ts, and utils.ts at the top. After: a Bulletproof React structure with app, one folder per feature, shared components and lib, and utils split by topic.">
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/banjo/pilotlint/main/assets/before-after-utils.svg" alt="Before: src/utils.ts with loose date and price functions and a default export. After: src/utils/dateUtil.ts with only date functions, exported as one DateUtil object.">
</p>

See [the config for this demo](https://github.com/banjo/pilotlint#before-and-after),
and [why pilotlint is not an ESLint plugin](https://github.com/banjo/pilotlint#why-not-an-eslint-plugin).

## Installation

```bash
npm install -D pilotlint @pilotlint/plugin-boundaries @pilotlint/presets
```

## Configuration

```ts
// pilotlint.config.ts
import boundaries from '@pilotlint/plugin-boundaries';
import { bulletproofReact } from '@pilotlint/presets';
import { defineConfig } from 'pilotlint';

export default defineConfig({
  extends: [boundaries.configs.recommended, bulletproofReact()],
});
```

No preset fits? [Describe your own structure](https://github.com/banjo/pilotlint/blob/main/docs/getting-started.md).

## Usage

| Command                           | What it does                                       |
| --------------------------------- | -------------------------------------------------- |
| `pilotlint check`                 | Check the project                                  |
| `pilotlint check --changed --new` | Report only what the current change broke          |
| `pilotlint describe [path]`       | Explain the structure, or what applies to one path |
| `pilotlint rules explain <id>`    | What a rule checks and how to fix its findings     |
| `pilotlint rules docs`            | Write Markdown docs for the rules                  |

Exit code `1` means findings, and `2` means pilotlint could not run, for example because of a
config error.

## Connect your agent

Copy the skill in `node_modules/pilotlint/skills/pilotlint/SKILL.md` into your agent's skills
directory, and add a hook that runs pilotlint after each edit.
[Set up your agent →](https://github.com/banjo/pilotlint/blob/main/docs/agents.md)

Or let your agent do it: copy the
[setup prompt](https://github.com/banjo/pilotlint#connect-your-agent) into your coding agent.

## License

MIT
