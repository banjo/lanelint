---
'@lanelint/presets': minor
---

Add `stores`, `repositories`, and `controllers` roles to Astra. Controllers are thin entry points such as server functions: they call services, hooks may call them, and services, repositories, and pure roles must not import them.

Add `stores` and `repositories` roles to Astra. Stores are client state and follow the rules of hooks. Repositories read and write data below services, and are not imported by constants, mappers, models, utils, components, or containers.
