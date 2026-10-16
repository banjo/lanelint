---
'@pilotlint/core': minor
'pilotlint': minor
'@pilotlint/plugin-boundaries': minor
'@pilotlint/plugin-conventions': minor
'@pilotlint/plugin-changes': minor
---

`pilotlint rules docs` writes Markdown docs for the rules: an index, and one page per plugin with each rule's description, default level, docs, options, and an example. `--check` exits with 1 when the pages are out of date. Options are read through Standard JSON Schema, so any validator that implements it works. Rules can set `meta.example`, plugins can set `description`, and the official plugins describe every option. `boundaries/allowed-imports` now starts its message with a capital letter.
