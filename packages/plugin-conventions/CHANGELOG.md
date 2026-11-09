# @lanelint/plugin-conventions

## 0.0.2

### Patch Changes

- 407a0c4: `conventions/export-matches-filename` takes `transform: 'capitalize'`, which upper-cases only the first letter of the file name, so `pdfURLUtil.ts` exports `PdfURLUtil`. Case conversions now split acronyms into words, so `pdfURLUtil` becomes `PdfUrlUtil` in pascal case instead of `PdfUrlutil`, and `pdf-url-util` in kebab case.
- @lanelint/core@0.0.2

## 0.0.1

First release as lanelint. Earlier versions were published as `@pilotlint/plugin-conventions`.
