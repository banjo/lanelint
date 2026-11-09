# @lanelint/presets

## 0.0.3

### Patch Changes

- fcb091c: Add `stores`, `repositories`, and `controllers` roles to Astra. Controllers are thin entry points such as server functions: they call services, hooks may call them, and services, repositories, and pure roles must not import them.

  Add `stores` and `repositories` roles to Astra. Stores are client state and follow the rules of hooks. Repositories read and write data below services, and are not imported by constants, mappers, models, utils, components, or containers.

- @lanelint/core@0.0.3
  - @lanelint/plugin-boundaries@0.0.3

## 0.0.2

### Patch Changes

- @lanelint/core@0.0.2
  - @lanelint/plugin-boundaries@0.0.2

## 0.0.1

First release as lanelint. Earlier versions were published as `@pilotlint/presets`.
