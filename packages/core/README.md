# @archlint/core

The engine, project model, and rule API behind [archlint](../../README.md).

Most projects install `archlint` instead, which re-exports `defineConfig`, `defineRule`, and
`definePlugin`. Plugin authors depend on `@archlint/core` as a peer dependency and test rules
with `@archlint/core/testing`:

```ts
import { describe, expect, it } from 'vitest';
import { testRule } from '@archlint/core/testing';
import { myRule } from '../src/myRule.ts';

testRule(
  'local/my-rule',
  myRule,
  {
    valid: [{ files: { 'src/a.ts': 'export const a = 1;' } }],
    invalid: [
      { files: { 'src/b.ts': 'export default 1;' }, findings: [{ path: 'src/b.ts', line: 1 }] },
    ],
  },
  { describe, it, expect },
);
```
