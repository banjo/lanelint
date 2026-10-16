# pilotlint

## 0.1.0

### Minor Changes

- baed5fd: First version: the engine and rule API, the CLI with `check`, `describe`, and `rules`, the agent skill, and the boundaries, conventions, and changes plugins.
- 9e87873: `pilotlint rules docs` writes Markdown docs for the rules: an index, and one page per plugin with each rule's description, default level, docs, options, and an example. `--check` exits with 1 when the pages are out of date. Options are read through Standard JSON Schema, so any validator that implements it works. Rules can set `meta.example`, plugins can set `description`, and the official plugins describe every option. `boundaries/allowed-imports` now starts its message with a capital letter.
- 6f58416: `defineConfig` knows the rules of plugins in `extends`, not only in `plugins`, so rule ids and options from a plugin's configs are typed without listing the plugin twice. `defineConfigFragment` checks a fragment's rules against its plugins, and configs that extend the fragment know them too.

### Patch Changes

- 2b265a8: Code with side effects now lives in services (`GitService`, `SnapshotService`, `ResolveService`, `ParseService`, `ConfigService`, `PackageService`, `CommandService`), and utils are pure functions. Defaults such as `SOURCE_EXTENSIONS` and `DEFAULT_IGNORE` are exported from `@pilotlint/core`. `boundaries/restricted-packages` can now restrict Node builtins as `node:<name>`, and the new `boundaries/restricted-globals` restricts globals such as `fetch`, `process`, and `Date.now`. `AstUtil` in `@pilotlint/core` walks an AST and finds declared names, for rules that inspect code.
- Updated dependencies [baed5fd]
- Updated dependencies [9e87873]
- Updated dependencies [2b265a8]
- Updated dependencies [6f58416]
  - @pilotlint/core@0.1.0
