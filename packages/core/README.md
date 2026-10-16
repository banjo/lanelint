# @pilotlint/core

[![npm](https://img.shields.io/npm/v/@pilotlint/core)](https://www.npmjs.com/package/@pilotlint/core)

The engine and rule API behind [pilotlint](https://github.com/banjo/pilotlint), for authors of
plugins. To check a project, install [`pilotlint`](https://www.npmjs.com/package/pilotlint)
instead.

## Install

Plugins depend on core as a peer dependency:

```json
{
  "peerDependencies": { "@pilotlint/core": "^0.1.0" }
}
```

## Write a rule

```ts
import { definePlugin, defineRule } from '@pilotlint/core';

const noLegacyImports = defineRule({
  meta: {
    description: 'New code must not import from src/legacy.',
    severity: 'error',
    docs: 'src/legacy is being removed. To fix a finding, use the replacement in src/common.',
  },
  create: (context) => ({
    import(edge) {
      if (edge.target.type === 'internal' && edge.target.file.path.startsWith('src/legacy/')) {
        context.report({ at: edge, message: `Do not import ${edge.target.file.path}.` });
      }
    },
  }),
});

export default definePlugin({ name: 'legacy', rules: { 'no-legacy-imports': noLegacyImports } });
```

Options take any [Standard Schema](https://standardschema.dev), such as Zod, Valibot, or
ArkType, and their types flow into `defineConfig`.

## Test a rule

```ts
import { testRule } from '@pilotlint/core/testing';
import { describe, expect, it } from 'vitest';

testRule(
  'legacy/no-legacy-imports',
  noLegacyImports,
  {
    valid: [
      { files: { 'src/a.ts': "import { b } from './b.ts';", 'src/b.ts': 'export const b = 1;' } },
    ],
    invalid: [
      {
        files: {
          'src/a.ts': "import { c } from './legacy/c.ts';",
          'src/legacy/c.ts': 'export const c = 1;',
        },
        findings: [{ path: 'src/a.ts', line: 1 }],
      },
    ],
  },
  { describe, it, expect },
);
```

## Docs

- [Writing rules](https://github.com/banjo/pilotlint/blob/main/docs/writing-rules.md): visitors,
  context, options, tests, and publishing
- [Concepts](https://github.com/banjo/pilotlint/blob/main/docs/concepts.md): elements, imports,
  and findings

## License

MIT
