---
'@lanelint/plugin-conventions': patch
---

`conventions/export-matches-filename` takes `transform: 'capitalize'`, which upper-cases only the first letter of the file name, so `pdfURLUtil.ts` exports `PdfURLUtil`. Case conversions now split acronyms into words, so `pdfURLUtil` becomes `PdfUrlUtil` in pascal case instead of `PdfUrlutil`, and `pdf-url-util` in kebab case.
