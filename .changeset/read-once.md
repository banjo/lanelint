---
'@pilotlint/core': patch
---

`--new` reads each unchanged file once instead of twice. `stats` now counts files read from disk or git and specifiers the resolver resolves, not cache hits.
