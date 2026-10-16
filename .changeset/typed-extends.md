---
'@pilotlint/core': minor
'pilotlint': minor
---

`defineConfig` knows the rules of plugins in `extends`, not only in `plugins`, so rule ids and options from a plugin's configs are typed without listing the plugin twice. `defineConfigFragment` checks a fragment's rules against its plugins, and configs that extend the fragment know them too.
