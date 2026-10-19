# @pilotlint/presets

## 0.2.3

### Patch Changes

- Updated dependencies [f5b3819]
- Updated dependencies [7f62411]
  - @pilotlint/core@0.2.3
  - @pilotlint/plugin-boundaries@0.2.3

## 0.2.2

### Patch Changes

- Updated dependencies [c836a86]
  - @pilotlint/core@0.2.2
  - @pilotlint/plugin-boundaries@0.2.2

## 0.2.1

### Patch Changes

- @pilotlint/core@0.2.1
  - @pilotlint/plugin-boundaries@0.2.1

## 0.2.0

### Minor Changes

- ffb8ae4: New package `@pilotlint/presets` with presets for Feature-Sliced Design, Bulletproof React, monorepos, Clean Architecture, and layered backends. Each preset gives hints that fit its architecture.

  Elements from `extends` are now added after the elements in the config, the last fragment first, instead of being replaced by them. Element `entry` accepts globs. `@pilotlint/core/testing` has `runConfig`, which checks files with a whole config.

  `boundaries/allowed-imports` applies `disallow` selectors with only `files` to imports inside one element too, so file-based layers are checked inside an element.

  `boundaries/allowed-imports` rules take a `hint`, shown under their findings. `pilotlint describe` places a directory that does not exist yet in its element, so a new feature folder shows the rules of a feature.

  New rule `boundaries/workspace-imports`: imports of other workspace packages must use the package name and a subpath that its `exports` lists. The `monorepo` preset uses it instead of `boundaries/entry-only`. `PackageInfo` has the package's `exports`.

  `boundaries/no-undeclared-dependency` lets test and config files use packages declared in the root package.json, where monorepos keep shared dev tools. Set `allowRootDev: false` to turn this off.

### Patch Changes

- Updated dependencies [6f22e2d]
- Updated dependencies [ffb8ae4]
- Updated dependencies [6d7bf30]
- Updated dependencies [fe71cde]
  - @pilotlint/core@0.2.0
  - @pilotlint/plugin-boundaries@0.2.0
