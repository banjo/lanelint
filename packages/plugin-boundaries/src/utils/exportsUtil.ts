/** Exports keys with their targets, or `undefined` when the package has no `exports` field. */
const entriesOf = (exports: unknown): (readonly [string, unknown])[] | undefined => {
  if (exports === undefined) {
    return undefined;
  }
  if (exports === null || typeof exports !== 'object' || Array.isArray(exports)) {
    return [['.', exports]];
  }
  const entries = Object.entries(exports);
  // An object of conditions, such as `{ import, require }`, exports the root only.
  return entries.some(([key]) => key.startsWith('.')) ? entries : [['.', exports]];
};

const matches = (key: string, subpath: string): boolean => {
  const star = key.indexOf('*');
  if (star === -1) {
    return key.endsWith('/') ? subpath.startsWith(key) : key === subpath;
  }
  const prefix = key.slice(0, star);
  const suffix = key.slice(star + 1);
  return (
    subpath.length >= prefix.length + suffix.length &&
    subpath.startsWith(prefix) &&
    subpath.endsWith(suffix)
  );
};

/**
 * Whether a package exports a subpath, such as `.` or `./icons`, following Node: exact keys win
 * over patterns, the longest pattern wins, and a `null` target blocks the subpath.
 */
const isExported = (exports: unknown, subpath: string): boolean => {
  const entries = entriesOf(exports);
  if (!entries) {
    return true;
  }
  const exact = entries.find(([key]) => key === subpath);
  const match =
    exact ??
    entries
      .filter(([key]) => key !== subpath && matches(key, subpath))
      .sort(([a], [b]) => b.length - a.length)[0];
  return !!match && match[1] !== null;
};

/** Exported subpaths, for messages. */
const subpathsOf = (exports: unknown): string[] =>
  (entriesOf(exports) ?? []).filter(([, target]) => target !== null).map(([key]) => key);

export const ExportsUtil = {
  isExported,
  subpathsOf,
};
