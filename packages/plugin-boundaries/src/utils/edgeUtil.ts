import type { ImportEdge, ProjectFile } from '@lanelint/core';

const VALID_PACKAGE = /^(?:@[a-z0-9~][\w.~-]*\/)?[a-z0-9~][\w.~-]*$/i;

const isBare = (specifier: string) =>
  !specifier.startsWith('.') &&
  !specifier.startsWith('/') &&
  !specifier.startsWith('#') &&
  !/^[A-Za-z]:[\\/]/.test(specifier);

/** The npm package name of a bare specifier, or `undefined` for relative paths and aliases. */
const packageNameOf = (specifier: string): string | undefined => {
  if (!isBare(specifier)) {
    return undefined;
  }
  const parts = specifier.split('/');
  const name = specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
  return name && VALID_PACKAGE.test(name) ? name : undefined;
};

/** The internal file an edge points to, if any. */
const internalTarget = (edge: ImportEdge): ProjectFile | undefined =>
  edge.target.type === 'internal' ? edge.target.file : undefined;

interface EdgeFilter {
  readonly includeTests?: boolean;
  readonly ignoreTypeImports?: boolean;
}

/** Skips edges from test files and type-only edges unless the options include them. */
const skip = (edge: ImportEdge, options: EdgeFilter): boolean =>
  (edge.from.isTest && !options.includeTests) || (edge.typeOnly && !!options.ignoreTypeImports);

/** `the feature src/features/a`, or the file path for files outside elements. */
/** How a file is named in a message: its element, or its path. `start` begins a sentence. */
const nameOf = (file: ProjectFile, start = false): string =>
  file.element ? `${start ? 'The' : 'the'} ${file.element.type} ${file.element.root}` : file.path;

export const EdgeUtil = {
  internalTarget,
  isBare,
  nameOf,
  packageNameOf,
  skip,
};
