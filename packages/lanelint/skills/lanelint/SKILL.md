---
name: lanelint
description: Check that code follows the project structure with lanelint. Use before creating files in an unfamiliar area, after every change, and when lanelint reports a finding you need to fix.
---

# lanelint

lanelint checks the project structure: where files go, how they are named, what they
export, which parts may import which, and which files must change together. The rules come
from `lanelint.config.ts`, which a human owns. lanelint does not check types, lint, or
tests, so run those too.

## Before writing code

When you create files in an area you have not worked in yet, ask what applies there. The
path does not need to exist:

```bash
lanelint describe src/features/calendar/hooks/useSlots.ts
```

Run `lanelint describe` without a path to see the whole structure: the elements, what each
may import, and the conventions.

## After every change

```bash
lanelint check --changed --new
```

`--changed` limits the report to files that differ from `HEAD`. `--new` hides findings
that already existed, so you only see what your change caused. Fix every error and warning
it reports before you continue.

Each finding has a location, a rule id, a message, and often a hint:

```
src/features/calendar/hooks/useSlots.ts:12 error boundaries/entry-only Import src/features/booking through its entry file, not src/features/booking/hooks/useBooking.ts.
  hint: Export what you need from src/features/booking/index.ts and import it from there.
```

If you do not understand a finding, read the rule's explanation:

```bash
lanelint rules explain boundaries/entry-only
```

## Rules for fixing findings

- Fix the code. Do not change `lanelint.config.ts`, and do not add `@ts-ignore`,
  `eslint-disable`, or similar comments to make a finding go away.
- `lanelint/config-changed` means the config differs from `HEAD`. Stop and ask a human to
  review the change, or revert it.
- Exit code 1 means findings at the failing level. Exit code 2 means lanelint itself could
  not run, for example a broken config or an unknown option. Report exit code 2 to a human
  instead of working around it.
- A long report ends with counts per rule. Narrow the next run with a path or `--rule`:

  ```bash
  lanelint check src/features/calendar --rule boundaries/entry-only
  ```

## Also run

lanelint only checks structure. Run the project's type check, lint, and tests as well, for
example `vp check` and `vp test`.
