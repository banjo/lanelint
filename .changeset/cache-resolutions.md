---
'@pilotlint/core': patch
'pilotlint': patch
---

Faster startup and resolution. pilotlint keeps what each import resolved to between runs, in `node_modules/.cache/pilotlint/resolutions.json`, until a file is added or removed, or a tsconfig, package.json, lockfile, or `node_modules` changes. `stats` counts these as `resolutionsFromCache`. The CLI loads the config with jiti directly instead of through c12, loads oxc-parser only when a file needs parsing, and enables Node's compile cache.
