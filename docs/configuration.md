# Configuration

lanelint reads `lanelint.config.ts` (or `.mts`, `.cts`, `.js`, `.mjs`, `.cjs`) from the
current directory or the nearest parent that has one. Pass `--config <path>` to use another
file.

```ts
import boundaries from '@lanelint/plugin-boundaries';
import changes from '@lanelint/plugin-changes';
import conventions from '@lanelint/plugin-conventions';
import { defineConfig } from 'lanelint';
import local from './lanelint/plugin.ts';

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
| `gitignore` | `boolean`                      | `true`                                                     | Leave out files that git ignores. See [Files](#files).                     |
| `tests`     | `string[]`                     | `['**/*.{test,spec}.*', '**/__tests__/**', '**/tests/**']` | Globs of test files.                                                       |
| `failOn`    | `'error' \| 'warn' \| 'never'` | `'error'`                                                  | The level that makes the run fail with exit code `1`.                      |
| `elements`  | `ElementDefinition[]`          | `[]`                                                       | The parts of the architecture. See [Elements](#elements).                  |
| `plugins`   | `Plugin[]`                     | `[]`                                                       | Plugins whose rules the config can use.                                    |
| `extends`   | `ConfigFragment[]`             | `[]`                                                       | Shared configs, applied before `rules`. See [Extends](#extends).           |
| `rules`     | `Record<string, RuleEntry>`    | `{}`                                                       | Rule levels and options. See [Rules](#rules).                              |
| `overrides` | `OverrideConfig[]`             | `[]`                                                       | Rules for some files or elements. See [Overrides](#overrides).             |

All globs use `/` as the separator, are relative to the root, and support `*`, `**`, `?`,
`{a,b}`, and `[abc]`.

## Files

In a git repository, lanelint asks git for the files instead of walking the directories:
tracked files, and untracked files that `.gitignore` does not exclude. `include` and `ignore`
then pick the project files from that list. This is faster, and generated or ignored files
stay out without listing them in `ignore`. Files in git submodules are left out.

Set `gitignore: false` to walk the directories instead, for example when the project checks
generated files that git ignores. Outside a git repository, lanelint always walks the
directories.

## Elements

```ts
{
  type: string;                                // element type, used by rules and overrides
  pattern: string;                             // directory pattern, such as 'src/features/:name'
  where?: Record<string, string[]>;            // allowed values per capture
  entry?: string | string[];                   // entry files or globs, relative to the element root
  description?: string;                        // shown by lanelint describe
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
  'lanelint/stale-config': 'off',
}
```

- Levels are `'off'`, `'warn'`, and `'error'`.
- A level without options keeps the options set earlier, for example in `extends`.
- Rule ids are `<plugin>/<rule>`. `defineConfig` knows the rules of the plugins in `plugins`
  and `extends`, so unknown ids and wrong options are type errors in your editor.
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

| Field         | Type                        | Description                                            |
| ------------- | --------------------------- | ------------------------------------------------------ |
| `description` | `string`                    | Why the override exists. Shown by `lanelint describe`. |
| `files`       | `string[]`                  | Globs of locations the override applies to.            |
| `ignore`      | `string[]`                  | Globs of locations it does not apply to.               |
| `elements`    | `string[]`                  | Element types it applies to.                           |
| `rules`       | `Record<string, RuleEntry>` | Rule entries, as in `rules`.                           |

When an override has both `files` and `elements`, a location must match both.

## Order

lanelint applies `extends` in order, then `rules`, then `overrides` in order. The last
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

A plugin's configs bring the plugin with them, so a plugin used in `extends` does not need
to be in `plugins` too. Elements from fragments are added after the elements in the config,
the last fragment first. Since a file belongs to the first element that matches, your own
elements and later fragments win.

[Presets](presets/README.md) are fragments for well-known architectures, with elements and
import rules:

```ts
extends: [boundaries.configs.recommended, monorepo(), featureSliced({ root: 'apps/:app/src' })],
```

To share a config between projects, publish a fragment made with `defineConfigFragment`. It
checks the fragment's rules against its plugins, and configs that extend it know them too:

```ts
import boundaries from '@lanelint/plugin-boundaries';
import { defineConfigFragment } from 'lanelint';

export default defineConfigFragment({
  plugins: [boundaries],
  rules: { 'boundaries/no-cycles': 'error' },
});
```

## Local rules

Rules that only make sense in one project live in the project, as a local plugin. See
[Writing rules](writing-rules.md).

## Validation

lanelint checks the config before it runs and exits with code `2` when:

- a rule id is unknown, or its plugin is not listed
- options do not match the rule's schema
- a rule or override refers to an element type that is not defined
- two different plugins have the same name
