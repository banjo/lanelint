---
'pilotlint': patch
---

TypeScript configs load through jiti. Node no longer warns about `MODULE_TYPELESS_PACKAGE_JSON` in packages without `"type": "module"`, and configs that import local files without an extension load on the first try, which also makes startup faster.
