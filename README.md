# pilotlint

pilotlint keeps coding agents on course. It is a fast, structure-agnostic architecture
linter for TypeScript projects, built for code written by AI agents.

One config file describes the structure of a codebase: which parts exist, how they may
depend on each other, how files and directories are named and shaped, and which files must
change together. An agent reads the structure before it writes code, runs `pilotlint check`
after each change, and gets a short list of the problems it introduced.

> `pilotlint` is a working name. See [PLAN.md](./PLAN.md) for the design and open questions.

## Example

```ts
// pilotlint.config.ts
import boundaries from '@pilotlint/plugin-boundaries';
import conventions from '@pilotlint/plugin-conventions';
import { defineConfig } from 'pilotlint';

export default defineConfig({
  elements: [
    { type: 'feature', pattern: 'src/features/:name', description: 'A user-facing feature.' },
    { type: 'domain', pattern: 'src/common/:name' },
  ],
  plugins: [boundaries, conventions],
  extends: [boundaries.configs.recommended, conventions.configs.recommended],
  rules: {
    'boundaries/entry-only': ['error', { elements: 'feature' }],
    'boundaries/allowed-imports': ['error', { rules: [{ from: 'domain', disallow: 'feature' }] }],
    'conventions/directory-case': ['error', { case: 'kebab' }],
  },
  overrides: [
    {
      description: 'Feature code uses named exports.',
      elements: ['feature'],
      rules: { 'conventions/no-default-export': 'error' },
    },
  ],
});
```

```
$ pilotlint check --changed --new
src/features/calendar/hooks/useSlots.ts:2 error boundaries/entry-only Import src/features/booking through its entry file, not src/features/booking/components/bookingPage.ts.
  hint: Export what you need from src/features/booking/index.ts and import it from there.
1 error, 0 warnings in 1 file, new since HEAD (184 ms)
```

Elements are optional and come from your config, so pilotlint fits any layout: feature
folders, Feature-Sliced Design, or a monorepo with `packages/:name`. See
[examples/](./examples).

## Commands

| Command                              | What it does                                                      |
| ------------------------------------ | ----------------------------------------------------------------- |
| `pilotlint check [paths...]`         | Check the project, or report only on these files and directories  |
| `pilotlint check --changed`          | Report only on files that differ from the base ref (`HEAD`)       |
| `pilotlint check --new`              | Report only findings that do not exist at the base ref            |
| `pilotlint check --base origin/main` | Compare with another ref, for example in CI                       |
| `pilotlint describe [path]`          | The structure as Markdown, or what applies to one path            |
| `pilotlint rules list`               | Active rules and their levels                                     |
| `pilotlint rules explain <id>`       | What a rule checks, how it is configured, and how to fix findings |

Other `check` flags: `--rule <id>` (repeatable), `--fail-on error|warn|never`,
`--format compact|json`, `--max-findings <n>`, `--config <path>`.

Exit codes: `0` no failing findings, `1` findings at the `failOn` level, `2` a usage or
config problem.

## Plugins

| Package                         | Rules                                                                                                                                                                                                                                                 |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@pilotlint/plugin-boundaries`  | `allowed-imports`, `entry-only`, `no-entry-import`, `public-api`, `no-cycles`, `no-unresolved`, `restricted-packages`, `restricted-globals`, `no-undeclared-dependency`, `no-orphans`                                                                 |
| `@pilotlint/plugin-conventions` | `no-default-export`, `file-name-case`, `directory-case`, `forbidden-files`, `forbidden-directories`, `root-only-files`, `file-name-pattern`, `required-files`, `companion-files`, `export-matches-filename`, `export-name-pattern`, `no-suppressions` |
| `@pilotlint/plugin-changes`     | `requires-change`, `no-manual-edit`                                                                                                                                                                                                                   |

Run `pilotlint rules explain <id>` for the options and docs of each rule.

## Writing rules

Rules are TypeScript. Options use any [Standard Schema](https://standardschema.dev)
validator, and their types flow into `defineConfig`.

```ts
import { defineRule, definePlugin } from 'pilotlint';
import * as v from 'valibot';

const noLegacyImports = defineRule({
  meta: { description: 'No imports from src/legacy.', severity: 'error' },
  options: v.object({ allow: v.optional(v.array(v.string()), []) }),
  create: (context) => ({
    import(edge) {
      if (edge.target.type === 'internal' && edge.target.file.path.startsWith('src/legacy/')) {
        context.report({ at: edge, message: `Do not import ${edge.target.file.path}.` });
      }
    },
  }),
});

export default definePlugin({ name: 'local', rules: { 'no-legacy-imports': noLegacyImports } });
```

Visitors are `file`, `directory`, `element`, `text`, `module`, `import`, `ast`, and
`project`. pilotlint only reads and parses what the active visitors need. Test rules with
`runRule` and `testRule` from `@pilotlint/core/testing`.

## Agent integration

1. **Skill.** `pilotlint` ships `skills/pilotlint/SKILL.md`. Copy it into your agent's skills
   directory, or point your agent instructions at it.
2. **Hooks.** Run pilotlint after every edit so the agent does not have to remember it. For
   Claude Code, in `.claude/settings.json` (exit code 2 shows the report to the agent):

   ```json
   {
     "hooks": {
       "PostToolUse": [
         {
           "matcher": "Edit|MultiEdit|Write",
           "hooks": [
             {
               "type": "command",
               "command": "npx pilotlint check --new \"$(jq -r '.tool_input.file_path')\" 1>&2; [ $? -ne 1 ] || exit 2"
             }
           ]
         }
       ]
     }
   }
   ```

   In OpenCode, a plugin can run the same command from `ctx.tool.hook('execute.after', ...)`
   for the `edit` and `write` tools. See the
   [OpenCode plugin docs](https://opencode.ai/v2/docs/build/plugins) for the hook event.

3. **Commit hooks and CI.** Run `pilotlint check --changed --new` before commits, for example
   from the `staged` block in `vite.config.ts`, and `pilotlint check --base origin/main --new`
   in CI.

## Development

The repository uses [Vite+](https://viteplus.dev):

```bash
pnpm install
vp check            # format, lint, and type check
vp run -r test      # tests in every package
vp run -r build     # build every package
pnpm pilotlint       # check this repository with pilotlint
pnpm changeset      # describe a change for the changelog
```

| Package                                                        |                                             |
| -------------------------------------------------------------- | ------------------------------------------- |
| [`packages/core`](./packages/core)                             | Engine, project model, rule API             |
| [`packages/pilotlint`](./packages/pilotlint)                   | CLI, config loading, reporters, agent skill |
| [`packages/plugin-boundaries`](./packages/plugin-boundaries)   | Dependency rules                            |
| [`packages/plugin-conventions`](./packages/plugin-conventions) | Naming, placement, and export rules         |
| [`packages/plugin-changes`](./packages/plugin-changes)         | Rules about files that change together      |
