# @pilotlint/core

## 0.2.3

### Patch Changes

- f5b3819: Faster startup and resolution. pilotlint keeps what each import resolved to between runs, in `node_modules/.cache/pilotlint/resolutions.json`, until a file is added or removed, or a tsconfig, package.json, lockfile, or `node_modules` changes. `stats` counts these as `resolutionsFromCache`. The CLI loads the config with jiti directly instead of through c12, loads oxc-parser only when a file needs parsing, and enables Node's compile cache.
- 7f62411: In a git repository, pilotlint asks git for the project files instead of walking the directories, so files that git ignores are left out without listing them in `ignore`. Changes against `HEAD` come from `git diff` and the same list of untracked files, so git scans the working tree once per run. Set `gitignore: false` in the config to walk the directories instead. Outside git, pilotlint always walks them.

## 0.2.2

### Patch Changes

- c836a86: Rules that read the AST or the text of files, such as `conventions/no-suppressions` and `conventions/export-matches-filename`, now make pilotlint read only the files where they are on. Before, one such rule limited to a few files by an override made pilotlint read every source file, even when the cache had the rest.

## 0.2.1

No changes in this release.

## 0.2.0

### Minor Changes

- 6f22e2d: pilotlint keeps the imports and exports of each file between runs in `node_modules/.cache/pilotlint`, keyed by the file's git hash. After an edit, only the changed files are read and parsed, which makes rules such as `no-cycles` much faster on large projects. `check --no-cache` turns it off, and `stats` counts the modules taken from the cache.
- ffb8ae4: New package `@pilotlint/presets` with presets for Feature-Sliced Design, Bulletproof React, monorepos, Clean Architecture, and layered backends. Each preset gives hints that fit its architecture.

  Elements from `extends` are now added after the elements in the config, the last fragment first, instead of being replaced by them. Element `entry` accepts globs. `@pilotlint/core/testing` has `runConfig`, which checks files with a whole config.

  `boundaries/allowed-imports` applies `disallow` selectors with only `files` to imports inside one element too, so file-based layers are checked inside an element.

  `boundaries/allowed-imports` rules take a `hint`, shown under their findings. `pilotlint describe` places a directory that does not exist yet in its element, so a new feature folder shows the rules of a feature.

  New rule `boundaries/workspace-imports`: imports of other workspace packages must use the package name and a subpath that its `exports` lists. The `monorepo` preset uses it instead of `boundaries/entry-only`. `PackageInfo` has the package's `exports`.

  `boundaries/no-undeclared-dependency` lets test and config files use packages declared in the root package.json, where monorepos keep shared dev tools. Set `allowRootDev: false` to turn this off.

- fe71cde: `check` returns `stats`, the work it did: files read, files parsed, and imports resolved. `--format json` shows them in `summary.stats`.

### Patch Changes

- 6d7bf30: `--new` reads each unchanged file once instead of twice. `stats` now counts files read from disk or git and specifiers the resolver resolves, not cache hits.

## 0.1.1

### Patch Changes

- New READMEs that explain what each package does, with examples and links to the docs.

## 0.1.0

### Minor Changes

- baed5fd: First version: the engine and rule API, the CLI with `check`, `describe`, and `rules`, the agent skill, and the boundaries, conventions, and changes plugins.
- 9e87873: `pilotlint rules docs` writes Markdown docs for the rules: an index, and one page per plugin with each rule's description, default level, docs, options, and an example. `--check` exits with 1 when the pages are out of date. Options are read through Standard JSON Schema, so any validator that implements it works. Rules can set `meta.example`, plugins can set `description`, and the official plugins describe every option. `boundaries/allowed-imports` now starts its message with a capital letter.
- 6f58416: `defineConfig` knows the rules of plugins in `extends`, not only in `plugins`, so rule ids and options from a plugin's configs are typed without listing the plugin twice. `defineConfigFragment` checks a fragment's rules against its plugins, and configs that extend the fragment know them too.

### Patch Changes

- 2b265a8: Code with side effects now lives in services (`GitService`, `SnapshotService`, `ResolveService`, `ParseService`, `ConfigService`, `PackageService`, `CommandService`), and utils are pure functions. Defaults such as `SOURCE_EXTENSIONS` and `DEFAULT_IGNORE` are exported from `@pilotlint/core`. `boundaries/restricted-packages` can now restrict Node builtins as `node:<name>`, and the new `boundaries/restricted-globals` restricts globals such as `fetch`, `process`, and `Date.now`. `AstUtil` in `@pilotlint/core` walks an AST and finds declared names, for rules that inspect code.
