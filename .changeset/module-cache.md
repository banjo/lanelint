---
'@pilotlint/core': minor
'pilotlint': minor
---

pilotlint keeps the imports and exports of each file between runs in `node_modules/.cache/pilotlint`, keyed by the file's git hash. After an edit, only the changed files are read and parsed, which makes rules such as `no-cycles` much faster on large projects. `check --no-cache` turns it off, and `stats` counts the modules taken from the cache.
