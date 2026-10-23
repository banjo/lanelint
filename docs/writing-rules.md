# Writing rules

Rules that only one project needs live in that project as a local plugin. Rules for many
projects go in a published plugin. Both are written the same way.

## Coming from ESLint

The rule API follows ESLint where it fits, so most of what you know carries over:

| ESLint                                    | lanelint                                                                      |
| ----------------------------------------- | ----------------------------------------------------------------------------- |
| `meta.docs.description`                   | `meta.description`                                                            |
| `meta.schema` (JSON Schema)               | `options` (any Standard Schema, such as Zod or Valibot)                       |
| `create(context)` with AST node visitors  | `create(context)` with `file`, `import`, `ast`, `project`, and other visitors |
| `context.report({ node, message })`       | `context.report({ at, message, hint })`                                       |
| `context.options`                         | `context.options`, validated and typed                                        |
| A plugin with `rules` and `configs`       | `definePlugin({ name, rules, configs })`                                      |
| `'off'`, `'warn'`, `'error'`              | The same                                                                      |
| Config objects with `files` and `ignores` | `overrides` with `files`, `ignore`, and `elements`                            |
| `RuleTester` with `valid` and `invalid`   | `testRule` with `valid` and `invalid`                                         |
| ESTree AST                                | The same ESTree AST, with TypeScript nodes, from Oxc                          |
| `// eslint-disable` comments              | None, on purpose: only the config can turn a rule off                         |

The difference is the scope. An ESLint rule sees one file. A lanelint rule can also see
directories, elements, the resolved import graph, and the files that changed since a git ref.

## A local plugin

```ts
// lanelint/plugin.ts
import { toStandardJsonSchema } from '@valibot/to-json-schema';
import { definePlugin, defineRule } from 'lanelint';
import * as v from 'valibot';

const noLegacyImports = defineRule({
  meta: {
    description: 'New code must not import from src/legacy.',
    severity: 'error',
    docs: 'src/legacy is being removed. To fix a finding, use the replacement in src/common.',
    example: ['error', { allow: ['src/legacy'] }],
  },
  options: toStandardJsonSchema(
    v.optional(
      v.object({
        allow: v.optional(
          v.pipe(v.array(v.string()), v.description('Directories that may still import it.')),
          [],
        ),
      }),
      {},
    ),
  ),
  create: (context) => ({
    import(edge) {
      const target = edge.target;
      if (
        target.type === 'internal' &&
        target.file.path.startsWith('src/legacy/') &&
        !context.options.allow.some((directory) => edge.from.path.startsWith(`${directory}/`))
      ) {
        context.report({
          at: edge,
          message: `Do not import ${target.file.path}.`,
          hint: 'Use the replacement in src/common.',
        });
      }
    },
  }),
});

export default definePlugin({
  name: 'local',
  description: 'Rules for this project.',
  rules: { 'no-legacy-imports': noLegacyImports },
});
```

```ts
// lanelint.config.ts
import { defineConfig } from 'lanelint';
import local from './lanelint/plugin.ts';

export default defineConfig({
  plugins: [local],
  rules: { 'local/no-legacy-imports': 'error' },
});
```

## Meta

| Field         | Description                                                                         |
| ------------- | ----------------------------------------------------------------------------------- |
| `description` | One sentence about what the rule checks                                             |
| `severity`    | Default level, `'warn'` or `'error'`, used when the config gives no level           |
| `docs`        | Markdown: why the rule exists and how to fix a finding. Shown by `rules explain`    |
| `example`     | A config entry for the rule, shown in the generated docs. Checked against `options` |

Agents read `docs` and the hints of findings to fix problems, so say what to do, not only
what is wrong.

## Options

`options` takes any [Standard Schema](https://standardschema.dev): Zod, Valibot, ArkType, and
others. lanelint validates the options in the config with it, and its types flow into
`defineConfig` and `context.options`.

For the generated docs, the schema should also implement
[Standard JSON Schema](https://standardschema.dev/json-schema). Zod 4.2+ and ArkType 2.1.28+
do so as they are. Wrap Valibot schemas in `toStandardJsonSchema` from
`@valibot/to-json-schema`, as above.

A rule that is turned on without options gets `undefined`. Make the whole options object
optional, with a default, when every option has one.

- Describe every option, for example with `v.description()` in Valibot or `.describe()` in
  Zod. The description becomes a column in the options table.
- Give shared types a title, for example `v.title('Selector')`. Each titled type is shown by
  name and documented once at the end of the page.
- Offer a `hint` option when the right fix depends on the project, for example which package
  to use instead of a banned one. When the fix is always the same, write the hint in the rule
  and leave the option out.

## Visitors

`create` returns visitors. lanelint reads and parses only what the active visitors need:

| Visitor     | Receives                                           | Runs for                          |
| ----------- | -------------------------------------------------- | --------------------------------- |
| `file`      | A file                                             | Each file in scope                |
| `directory` | A directory                                        | Each directory in scope           |
| `element`   | An element and its files                           | Each element with a file in scope |
| `text`      | A file and its contents                            | Each file in scope                |
| `module`    | A source file with its imports and exports         | Each source file in scope         |
| `import`    | An import, resolved                                | Each import from a file in scope  |
| `ast`       | A source file with its ESTree program and comments | Each source file in scope         |
| `project`   | The whole project, and may be `async`              | Once per run                      |

The `ast` visitor builds the program only when the rule reads `ast.program`. `AstUtil` from
`@lanelint/core` walks a program and finds declared names.

## Context

| Member                  | Description                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| `context.options`       | The validated options                                                                               |
| `context.report(...)`   | Reports a finding                                                                                   |
| `context.project`       | Files, directories, elements, packages, and async `read`, `module`, `ast`, `importsOf`, and `graph` |
| `context.changes`       | Files changed since the base ref. Using it needs git                                                |
| `context.isInScope(at)` | Whether findings at a location are shown in this run                                                |

`context.report` takes:

```ts
context.report({
  at, // a file, directory, element, import, { path, line? }, or 'project'
  message, // what is wrong, without line numbers
  hint, // optional: the next step
  key, // optional: identity within the location, the message by default
  related, // optional: other locations, such as the other files in a cycle
});
```

The identity of a finding is its rule id, location path, and key. Keep messages and keys free
of line numbers, so `--new` recognizes a finding after code moves.

## Shorthands

For a condition and a message, use `defineFileRule` or `defineDirectoryRule`:

```ts
import { defineFileRule } from 'lanelint';

export const noTypesFiles = defineFileRule({
  meta: { description: 'No types.ts files.', severity: 'warn' },
  when: (file) => file.name === 'types.ts',
  message: 'Move these types to named files in models/.',
});
```

## Tests

`@lanelint/core/testing` runs a rule on files in a temporary directory:

```ts
import { testRule } from '@lanelint/core/testing';
import { describe, expect, it } from 'vitest';
import { noTypesFiles } from '../src/noTypesFiles.ts';

testRule(
  'local/no-types-files',
  noTypesFiles,
  {
    valid: [{ files: { 'src/models/user.ts': 'export type User = {};' } }],
    invalid: [
      {
        files: { 'src/types.ts': 'export type User = {};' },
        findings: [{ path: 'src/types.ts', message: /named files/ }],
      },
    ],
  },
  { describe, it, expect },
);
```

A case can also set `options`, `config` (for example `elements`), and `base` files for rules
that compare with git. `runRule` returns the findings of one case, for your own assertions.

## Publishing a plugin

- Name the package `lanelint-plugin-<name>` or `@scope/lanelint-plugin-<name>`, and
  configs without rules `lanelint-config-<name>`.
- Depend on `@lanelint/core` as a peer dependency.
- Export the plugin as the default export, and add `configs` such as `recommended` for a
  good start.

## Documentation

Generate docs for your plugin's rules with:

```bash
lanelint rules docs --plugin <name> --out docs/rules
```

The page is made from `meta`, the options schema, and `example`, so the docs and the rules
cannot drift apart. Run it with `--check` in CI. See [CLI](cli.md#rules-docs).
