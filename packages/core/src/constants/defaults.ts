/** Extensions of files that can be parsed. */
export const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];

/** Always ignored, in addition to `ignore` in the config. */
export const DEFAULT_IGNORE = ['**/node_modules/**', '**/.git/**'];

/** Entry files of an element when its definition has no `entry`. */
export const DEFAULT_ENTRIES = [
  'index.ts',
  'index.tsx',
  'index.mts',
  'index.js',
  'index.jsx',
  'index.mjs',
];

/** Test files when the config has no `tests`. */
export const DEFAULT_TESTS = ['**/*.{test,spec}.*', '**/__tests__/**', '**/tests/**'];

/**
 * Options passed to Standard JSON Schema converters by vendor, so options are documented even
 * when a schema has checks or transforms that JSON Schema cannot express.
 */
export const JSON_SCHEMA_LIBRARY_OPTIONS: Readonly<
  Record<string, Readonly<Record<string, unknown>> | undefined>
> = {
  valibot: { typeMode: 'ignore', errorMode: 'ignore' },
  zod: { unrepresentable: 'any' },
};
