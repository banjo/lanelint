# pilotlint

[![npm](https://img.shields.io/npm/v/pilotlint)](https://www.npmjs.com/package/pilotlint)

### Steer your AI agent to the architecture you want.

Coding agents write code that works and put it in the wrong place. pilotlint lets you write
down how your project is structured, once, and checks every change against it. The agent gets
a short report with a hint after each edit, and fixes its own mistakes before you review.

```
$ pilotlint check --changed --new
src/features/calendar/hooks/useSlots.ts:1 error boundaries/entry-only Import src/features/booking through its entry file, not src/features/booking/components/bookingPage.ts.
  hint: Export what you need from src/features/booking/index.ts and import it from there.
1 error, 0 warnings in 1 file, new since HEAD (92 ms)
```

- **Made for agents:** one-line findings with hints, and `--new` to show only what a change
  caused.
- **Fast:** built on [Oxc](https://oxc.rs), so it can run after every edit.
- **Any structure:** you define the parts of your architecture; pilotlint does not assume one.
- **Familiar:** rules, plugins, and configs work like ESLint's.

This package has the CLI, `defineConfig`, and the agent skill. Read
[why pilotlint](https://github.com/banjo/pilotlint#why-pilotlint) for more.

## Install

```bash
npm install -D pilotlint @pilotlint/plugin-boundaries @pilotlint/plugin-conventions
```

## Configure

```ts
// pilotlint.config.ts
import boundaries from '@pilotlint/plugin-boundaries';
import conventions from '@pilotlint/plugin-conventions';
import { defineConfig } from 'pilotlint';

export default defineConfig({
  elements: [{ type: 'feature', pattern: 'src/features/:name' }],
  extends: [boundaries.configs.recommended, conventions.configs.recommended],
  rules: {
    'boundaries/entry-only': ['error', { elements: 'feature' }],
    'conventions/directory-case': ['error', { case: 'kebab' }],
  },
});
```

## Use

| Command                           | What it does                                       |
| --------------------------------- | -------------------------------------------------- |
| `pilotlint check`                 | Check the project                                  |
| `pilotlint check --changed --new` | Report only the problems the current change caused |
| `pilotlint describe [path]`       | Explain the structure, or what applies to one path |
| `pilotlint rules explain <id>`    | What a rule checks and how to fix its findings     |
| `pilotlint rules docs`            | Write Markdown docs for the rules                  |

Exit code `1` means findings, and `2` means pilotlint could not run, for example because of a
config error.

## Agents

The agent skill is in `node_modules/pilotlint/skills/pilotlint/SKILL.md`. Copy it into your
agent's skills directory. It tells the agent to run pilotlint after every change and to fix
the code rather than the config.

## Docs

- [Getting started](https://github.com/banjo/pilotlint/blob/main/docs/getting-started.md)
- [Configuration](https://github.com/banjo/pilotlint/blob/main/docs/configuration.md)
- [CLI](https://github.com/banjo/pilotlint/blob/main/docs/cli.md)
- [Rules](https://github.com/banjo/pilotlint/blob/main/docs/rules/README.md)
- [Agents](https://github.com/banjo/pilotlint/blob/main/docs/agents.md)

## License

MIT
