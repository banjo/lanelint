# @pilotlint/plugin-changes

[![npm](https://img.shields.io/npm/v/@pilotlint/plugin-changes)](https://www.npmjs.com/package/@pilotlint/plugin-changes)

[pilotlint](https://github.com/banjo/pilotlint) rules for changes: files that must change
together, and generated files that must not be edited by hand. The rules compare the working
tree with a git ref, `HEAD` by default.

## Install

```bash
npm install -D pilotlint @pilotlint/plugin-changes
```

## Use

```ts
// pilotlint.config.ts
import changes from '@pilotlint/plugin-changes';
import { defineConfig } from 'pilotlint';

export default defineConfig({
  plugins: [changes],
  rules: {
    'changes/requires-change': [
      'error',
      {
        rules: [
          {
            when: 'src/**/messages.ts',
            require: 'src/translations/en.json',
            hint: 'Run pnpm extract-intl.',
          },
        ],
      },
    ],
    'changes/no-manual-edit': [
      'error',
      {
        rules: [{ files: 'src/generated/**', unless: 'schema.graphql', hint: 'Run pnpm codegen.' }],
      },
    ],
  },
});
```

In CI, compare with the main branch: `pilotlint check --base origin/main`.

## Rules

| Rule                                                                                                    | Checks                                                             |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [`requires-change`](https://github.com/banjo/pilotlint/blob/main/docs/rules/changes.md#requires-change) | When some files change, the files that depend on them change too   |
| [`no-manual-edit`](https://github.com/banjo/pilotlint/blob/main/docs/rules/changes.md#no-manual-edit)   | Generated files change only together with the input they come from |

See [all options](https://github.com/banjo/pilotlint/blob/main/docs/rules/changes.md), or run
`pilotlint rules explain changes/<rule>`.

## License

MIT
