# @pilotlint/plugin-boundaries

[![npm](https://img.shields.io/npm/v/@pilotlint/plugin-boundaries)](https://www.npmjs.com/package/@pilotlint/plugin-boundaries)

[pilotlint](https://github.com/banjo/pilotlint) rules for imports: which parts of your
architecture may import which, and which packages and globals code may use.

## Install

```bash
npm install -D pilotlint @pilotlint/plugin-boundaries
```

## Use

```ts
// pilotlint.config.ts
import boundaries from '@pilotlint/plugin-boundaries';
import { defineConfig } from 'pilotlint';

export default defineConfig({
  elements: [
    { type: 'feature', pattern: 'src/features/:name' },
    { type: 'domain', pattern: 'src/common/:name' },
  ],
  extends: [boundaries.configs.recommended],
  rules: {
    'boundaries/entry-only': ['error', { elements: 'feature' }],
    'boundaries/allowed-imports': ['error', { rules: [{ from: 'domain', disallow: 'feature' }] }],
  },
});
```

`recommended` turns on `no-cycles`, `no-unresolved`, and `no-undeclared-dependency`.

## Rules

| Rule                                                                                                                         | Checks                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [`allowed-imports`](https://github.com/banjo/pilotlint/blob/main/docs/rules/boundaries.md#allowed-imports)                   | Which elements may import which                                          |
| [`entry-only`](https://github.com/banjo/pilotlint/blob/main/docs/rules/boundaries.md#entry-only)                             | Imports from outside an element target its entry files                   |
| [`no-cycles`](https://github.com/banjo/pilotlint/blob/main/docs/rules/boundaries.md#no-cycles)                               | Elements do not depend on each other in a cycle                          |
| [`no-entry-import`](https://github.com/banjo/pilotlint/blob/main/docs/rules/boundaries.md#no-entry-import)                   | Imports target the files they need, not entry files                      |
| [`no-orphans`](https://github.com/banjo/pilotlint/blob/main/docs/rules/boundaries.md#no-orphans)                             | Source files are imported by non-test code, or are an entry point        |
| [`no-undeclared-dependency`](https://github.com/banjo/pilotlint/blob/main/docs/rules/boundaries.md#no-undeclared-dependency) | Imported packages are declared in the nearest package.json               |
| [`no-unresolved`](https://github.com/banjo/pilotlint/blob/main/docs/rules/boundaries.md#no-unresolved)                       | Imports resolve to a file or an installed package                        |
| [`public-api`](https://github.com/banjo/pilotlint/blob/main/docs/rules/boundaries.md#public-api)                             | Imported files of an element are reachable from its entry files          |
| [`restricted-globals`](https://github.com/banjo/pilotlint/blob/main/docs/rules/boundaries.md#restricted-globals)             | Globals such as `fetch` or `Date.now` are not used where they are banned |
| [`restricted-packages`](https://github.com/banjo/pilotlint/blob/main/docs/rules/boundaries.md#restricted-packages)           | Packages, or names from them, are not imported where they are banned     |

See [all options](https://github.com/banjo/pilotlint/blob/main/docs/rules/boundaries.md), or
run `pilotlint rules explain boundaries/<rule>`.

## License

MIT
