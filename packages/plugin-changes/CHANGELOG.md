# @pilotlint/plugin-changes

## 0.1.1

### Patch Changes

- New READMEs that explain what each package does, with examples and links to the docs.
- Updated dependencies
  - @pilotlint/core@0.1.1

## 0.1.0

### Minor Changes

- baed5fd: First version: the engine and rule API, the CLI with `check`, `describe`, and `rules`, the agent skill, and the boundaries, conventions, and changes plugins.
- 9e87873: `pilotlint rules docs` writes Markdown docs for the rules: an index, and one page per plugin with each rule's description, default level, docs, options, and an example. `--check` exits with 1 when the pages are out of date. Options are read through Standard JSON Schema, so any validator that implements it works. Rules can set `meta.example`, plugins can set `description`, and the official plugins describe every option. `boundaries/allowed-imports` now starts its message with a capital letter.

### Patch Changes

- Updated dependencies [baed5fd]
- Updated dependencies [9e87873]
- Updated dependencies [2b265a8]
- Updated dependencies [6f58416]
  - @pilotlint/core@0.1.0
