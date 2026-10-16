# @pilotlint/plugin-conventions

[![npm](https://img.shields.io/npm/v/@pilotlint/plugin-conventions)](https://www.npmjs.com/package/@pilotlint/plugin-conventions)

[pilotlint](https://github.com/banjo/pilotlint) rules for conventions: how files and
directories are named, where they go, which files must exist, and what files export.

## Install

```bash
npm install -D pilotlint @pilotlint/plugin-conventions
```

## Use

```ts
// pilotlint.config.ts
import conventions from '@pilotlint/plugin-conventions';
import { defineConfig } from 'pilotlint';

export default defineConfig({
  extends: [conventions.configs.recommended],
  rules: {
    'conventions/directory-case': ['error', { case: 'kebab' }],
    'conventions/file-name-pattern': [
      'error',
      { rules: [{ directory: 'utils', pattern: '*Util.ts' }] },
    ],
  },
  overrides: [
    { files: ['src/**/utils/*Util.ts'], rules: { 'conventions/export-matches-filename': 'error' } },
  ],
});
```

`recommended` turns on `no-suppressions`, which stops comments such as `@ts-ignore` and
`eslint-disable` from hiding problems.

## Rules

| Rule                                                                                                                        | Checks                                                           |
| --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| [`companion-files`](https://github.com/banjo/pilotlint/blob/main/docs/rules/conventions.md#companion-files)                 | Files have their companion, such as a test next to a component   |
| [`directory-case`](https://github.com/banjo/pilotlint/blob/main/docs/rules/conventions.md#directory-case)                   | Directory names follow a naming case                             |
| [`export-matches-filename`](https://github.com/banjo/pilotlint/blob/main/docs/rules/conventions.md#export-matches-filename) | A file exports one value, named after the file                   |
| [`export-name-pattern`](https://github.com/banjo/pilotlint/blob/main/docs/rules/conventions.md#export-name-pattern)         | Exported names follow a pattern, such as `use*` in hooks         |
| [`file-name-case`](https://github.com/banjo/pilotlint/blob/main/docs/rules/conventions.md#file-name-case)                   | File names follow a naming case                                  |
| [`file-name-pattern`](https://github.com/banjo/pilotlint/blob/main/docs/rules/conventions.md#file-name-pattern)             | Files in some directories match a name pattern                   |
| [`forbidden-directories`](https://github.com/banjo/pilotlint/blob/main/docs/rules/conventions.md#forbidden-directories)     | Directories with these names do not exist                        |
| [`forbidden-files`](https://github.com/banjo/pilotlint/blob/main/docs/rules/conventions.md#forbidden-files)                 | Files with these names do not exist                              |
| [`no-default-export`](https://github.com/banjo/pilotlint/blob/main/docs/rules/conventions.md#no-default-export)             | Code uses named exports                                          |
| [`no-suppressions`](https://github.com/banjo/pilotlint/blob/main/docs/rules/conventions.md#no-suppressions)                 | No comments that switch off type checks, lint rules, or coverage |
| [`required-files`](https://github.com/banjo/pilotlint/blob/main/docs/rules/conventions.md#required-files)                   | Each element or matching directory has the files it needs        |
| [`root-only-files`](https://github.com/banjo/pilotlint/blob/main/docs/rules/conventions.md#root-only-files)                 | Some files exist only at the root of an element                  |

See [all options](https://github.com/banjo/pilotlint/blob/main/docs/rules/conventions.md), or
run `pilotlint rules explain conventions/<rule>`.

## License

MIT
