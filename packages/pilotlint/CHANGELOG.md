# pilotlint

## 0.2.2

### Patch Changes

- 370a6d3: TypeScript configs load through jiti. Node no longer warns about `MODULE_TYPELESS_PACKAGE_JSON` in packages without `"type": "module"`, and configs that import local files without an extension load on the first try, which also makes startup faster.
- Updated dependencies [c836a86]
  - @pilotlint/core@0.2.2

## 0.2.1

### Patch Changes

- New README, with a demo of an agent fixing a finding, and a new package description.
- @pilotlint/core@0.2.1

## 0.2.0

### Minor Changes

- 6f22e2d: pilotlint keeps the imports and exports of each file between runs in `node_modules/.cache/pilotlint`, keyed by the file's git hash. After an edit, only the changed files are read and parsed, which makes rules such as `no-cycles` much faster on large projects. `check --no-cache` turns it off, and `stats` counts the modules taken from the cache.
- fe71cde: `check` returns `stats`, the work it did: files read, files parsed, and imports resolved. `--format json` shows them in `summary.stats`.

### Patch Changes

- Updated dependencies [6f22e2d]
- Updated dependencies [ffb8ae4]
- Updated dependencies [6d7bf30]
- Updated dependencies [fe71cde]
  - @pilotlint/core@0.2.0

## 0.1.1

### Patch Changes

- New READMEs that explain what each package does, with examples and links to the docs.
- Updated dependencies
  - @pilotlint/core@0.1.1

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
