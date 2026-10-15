---
'@archlint/core': patch
'archlint': patch
'@archlint/plugin-boundaries': minor
---

Code with side effects now lives in services (`GitService`, `SnapshotService`, `ResolveService`, `ParseService`, `ConfigService`, `PackageService`, `CommandService`), and utils are pure functions. Defaults such as `SOURCE_EXTENSIONS` and `DEFAULT_IGNORE` are exported from `@archlint/core`. `boundaries/restricted-packages` can now restrict Node builtins as `node:<name>`, and the new `boundaries/restricted-globals` restricts globals such as `fetch`, `process`, and `Date.now`. `AstUtil` in `@archlint/core` walks an AST and finds declared names, for rules that inspect code.
