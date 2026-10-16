# Configuration

pilotlint reads `pilotlint.config.ts` (or `.mts`, `.cts`, `.js`, `.mjs`, `.cjs`) from the
current directory or the nearest parent that has one. Pass `--config <path>` to use another
file.

```ts
import boundaries from '@pilotlint/plugin-boundaries';
import changes from '@pilotlint/plugin-changes';
import conventions from '@pilotlint/plugin-conventions';
import { defineConfig } from 'pilotlint';
import local from './pilotlint/plugin.ts';

export default defineConfig({
  include: ['src/**', 'package.json'],
  ignore: ['src/generated/**'],
  failOn: 'error',
  elements: [
    { type: 'feature', pattern: 'src/features/:name', description: 'A user-facing feature.' },
    { type: 'domain', pattern: 'src/common/:name' },
  ],
  plugins: [boundaries, changes, conventions, local],
  extends: [boundaries.configs.recommended, conventions.configs.recommended],
  rules: {
    'boundaries/entry-only': ['error', { elements: 'feature' }],
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

## Fields

| Field       | Type                           | Default                                                    | Description                                                                |
| ----------- | ------------------------------ | ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| `root`      | `string`                       | the directory of the config file                           | Project root. Paths in the config and in findings are relative to it.      |
| `include`   | `string[]`                     | `['**/*']`                                                 | Globs of files that belong to the project.                                 |
| `ignore`    | `string[]`                     | `[]`                                                       | Globs of files to leave out. `node_modules` and `.git` are always ignored. |
| `tests`     | `string[]`                     | `['**/*.{test,spec}.*', '**/__tests__/**', '**/tests/**']` | Globs of test files.                                                       |
| `failOn`    | `'error' \| 'warn' \| 'never'` | `'error'`                                                  | The level that makes the run fail with exit code `1`.                      |
| `elements`  | `ElementDefinition[]`          | `[]`                                                       | The parts of the architecture. See [Elements](#elements).                  |
| `plugins`   | `Plugin[]`                     | `[]`                                                       | Plugins whose rules the config can use.                                    |
| `extends`   | `ConfigFragment[]`             | `[]`                                                       | Shared configs, applied before `rules`. See [Extends](#extends).           |
| `rules`     | `Record<string, RuleEntry>`    | `{}`                                                       | Rule levels and options. See [Rules](#rules).                              |
| `overrides` | `OverrideConfig[]`             | `[]`                                                       | Rules for some files or elements. See [Overrides](#overrides).             |

All globs use `/` as the separator, are relative to the root, and support `*`, `**`, `?`,
`{a,b}`, and `[abc]`.

## Elements

```ts
{
  type: string;                                // element type, used by rules and overrides
  pattern: string;                             // directory pattern, such as 'src/features/:name'
  where?: Record<string, string[]>;            // allowed values per capture
  entry?: string | string[];                   // entry files relative to the element root
  description?: string;                        // shown by pilotlint describe
}
```

A file belongs to the first element that matches, so put specific patterns first. See
[Concepts](concepts.md#elements) for how patterns match.

Other layouts:

```ts
// Feature-Sliced Design
elements: [
  { type: 'slice', pattern: 'src/:layer/:slice', where: { layer: ['features', 'entities', 'widgets', 'pages'] } },
  { type: 'layer', pattern: 'src/:layer' },
],

// Monorepo
elements: [{ type: 'package', pattern: 'packages/:name', entry: 'src/index.ts' }],
```

## Rules

A rule entry is a level, or a level with options:

```ts
rules: {
  'conventions/no-default-export': 'error',
  'boundaries/no-orphans': ['warn', { roots: ['src/main.ts'] }],
  'pilotlint/stale-config': 'off',
}
```

- Levels are `'off'`, `'warn'`, and `'error'`.
- A level without options keeps the options set earlier, for example in `extends`.
- Rule ids are `<plugin>/<rule>`. `defineConfig` knows the rules of the plugins in `plugins`,
  so unknown ids and wrong options are type errors in your editor.
- See [rules/](rules/README.md) for every rule and its options.

## Overrides

Overrides change rules for some locations. Each one selects locations and sets rules:

```ts
overrides: [
  {
    description: 'Util files export one object named after the file.',
    files: ['src/**/utils/*Util.ts'],
    rules: { 'conventions/export-matches-filename': 'error' },
  },
  {
    description: 'Feature and domain code uses named exports, except message catalogs.',
    elements: ['feature', 'domain'],
    ignore: ['**/messages.ts'],
    rules: { 'conventions/no-default-export': 'error' },
  },
],
```

| Field         | Type                        | Description                                             |
| ------------- | --------------------------- | ------------------------------------------------------- |
| `description` | `string`                    | Why the override exists. Shown by `pilotlint describe`. |
| `files`       | `string[]`                  | Globs of locations the override applies to.             |
| `ignore`      | `string[]`                  | Globs of locations it does not apply to.                |
| `elements`    | `string[]`                  | Element types it applies to.                            |
| `rules`       | `Record<string, RuleEntry>` | Rule entries, as in `rules`.                            |

When an override has both `files` and `elements`, a location must match both.

## Order

pilotlint applies `extends` in order, then `rules`, then `overrides` in order. The last
entry that applies to a location wins. Each finding is checked against the config at its
location: the rule must be on there, and the finding gets the level set there. Findings on
the whole project use the top-level config.

## Extends

`extends` takes config fragments: objects with `plugins`, `elements`, `rules`, and
`overrides`. Plugins publish theirs as `configs`:

```ts
extends: [boundaries.configs.recommended, conventions.configs.recommended],
```

| Config                            | Rules                                                        |
| --------------------------------- | ------------------------------------------------------------ |
| `boundaries.configs.recommended`  | `no-cycles`, `no-unresolved`, and `no-undeclared-dependency` |
| `conventions.configs.recommended` | `no-suppressions`                                            |

List the plugins of these configs in `plugins` too, so `defineConfig` knows their rules.
`elements` in the config replace the elements of fragments. Without them, the last fragment
with `elements` is used.

To share a config between projects, publish a fragment made with `defineConfigFragment`:

```ts
import boundaries from '@pilotlint/plugin-boundaries';
import { defineConfigFragment } from 'pilotlint';

export default defineConfigFragment({
  plugins: [boundaries],
  rules: { 'boundaries/no-cycles': 'error' },
});
```

## Local rules

Rules that only make sense in one project live in the project, as a local plugin. See
[Writing rules](writing-rules.md).

## Validation

pilotlint checks the config before it runs and exits with code `2` when:

- a rule id is unknown, or its plugin is not listed
- options do not match the rule's schema
- a rule or override refers to an element type that is not defined
- two different plugins have the same name
