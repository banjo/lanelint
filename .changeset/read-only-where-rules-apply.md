---
'@pilotlint/core': patch
---

Rules that read the AST or the text of files, such as `conventions/no-suppressions` and `conventions/export-matches-filename`, now make pilotlint read only the files where they are on. Before, one such rule limited to a few files by an override made pilotlint read every source file, even when the cache had the rest.
