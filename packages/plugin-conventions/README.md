# @archlint/plugin-conventions

Rules about names, placement, required files, and exports: `no-default-export`, `file-name-case`, `directory-case`, `forbidden-files`, `forbidden-directories`, `root-only-files`, `file-name-pattern`, `required-files`, `companion-files`, `export-matches-filename`, `export-name-pattern`, and `no-suppressions`.

```ts
import conventions from '@archlint/plugin-conventions';
import { defineConfig } from 'archlint';

export default defineConfig({
  plugins: [conventions],
});
```

Run `archlint rules explain conventions/<rule>` for the options and docs of each rule. See the
[repository README](../../README.md) for more.
