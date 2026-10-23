# Getting started

## Install

```bash
pnpm add -D lanelint @lanelint/plugin-boundaries @lanelint/plugin-conventions
```

lanelint needs Node 22.18 or later. Change rules and `--new` also need git.

## Write a config

Create `lanelint.config.ts` in the project root. This one describes a project with
feature folders and shared domain code:

```ts
import boundaries from '@lanelint/plugin-boundaries';
import conventions from '@lanelint/plugin-conventions';
import { defineConfig } from 'lanelint';

export default defineConfig({
  include: ['src/**'],
  elements: [
    { type: 'feature', pattern: 'src/features/:name', description: 'A user-facing feature.' },
    { type: 'domain', pattern: 'src/common/:name', description: 'Shared business logic.' },
  ],
  plugins: [boundaries, conventions],
  extends: [boundaries.configs.recommended, conventions.configs.recommended],
  rules: {
    'boundaries/entry-only': ['error', { elements: 'feature' }],
    'boundaries/allowed-imports': ['error', { rules: [{ from: 'domain', disallow: 'feature' }] }],
    'conventions/directory-case': ['error', { case: 'kebab' }],
  },
});
```

`defineConfig` knows the rules of the plugins in `plugins` and `extends`, so your editor
completes rule ids and checks their options.

If your project follows Feature-Sliced Design, Bulletproof React, a monorepo layout, Clean
Architecture, or a layered backend, a [preset](presets/README.md) writes the elements and
import rules for you:

```ts
import { featureSliced } from '@lanelint/presets';

export default defineConfig({
  extends: [boundaries.configs.recommended, featureSliced()],
});
```

## Run a check

```bash
npx lanelint check
```

```
src/common/date/dateRange.ts:1 error boundaries/allowed-imports The domain src/common/date must not import the feature src/features/booking.
  hint: Move the shared code to a place both may import, or invert the dependency.
src/features/calendar/hooks/useSlots.ts:1 error boundaries/entry-only Import src/features/booking through its entry file, not src/features/booking/components/bookingPage.ts.
  hint: Export what you need from src/features/booking/index.ts and import it from there.
2 errors, 0 warnings in 15 files (92 ms)
```

Each finding has a location, a level, a rule id, a message, and often a hint. The exit code
is `1` when there are errors, so the check can fail a commit or a CI job.

## Adopt it in an existing project

An existing project usually has findings already. Show only the findings that a change
introduces:

```bash
npx lanelint check --changed --new
```

`--changed` reports only on files that differ from `HEAD`, and `--new` hides findings that
already exist at `HEAD`. Fix the old findings when you have time, or set their rules to
`'warn'` until then.

## Next steps

- [Concepts](concepts.md): elements, findings, levels, and changes.
- [Configuration](configuration.md): every field of the config.
- [Rules](rules/README.md): what each rule checks and its options.
- [Agents](agents.md): the skill and hooks that make agents run lanelint.
- Complete configs: [feature folders](../examples/feature-folders/lanelint.config.ts),
  [a monorepo](../examples/monorepo/lanelint.config.ts), and
  [Bulletproof React with naming rules](../examples/bulletproof-react/lanelint.config.ts).
