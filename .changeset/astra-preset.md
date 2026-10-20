---
'@pilotlint/presets': patch
---

New preset `astra()` for feature-layered React apps, with features in `src/features` and shared business domains in `src/common`. Other code imports the files their `index.ts` exports, without cycles, and common domains do not import features. Every feature and domain has the same role directories: models, mappers, constants, utils, services, hooks, contexts, components, and containers. Each role may import only the roles below it, the pure roles do no I/O, and API calls stay in services.
