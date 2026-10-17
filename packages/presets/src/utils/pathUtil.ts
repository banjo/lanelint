/** Removes `./` and slashes at the ends. `.` and an empty string mean the project root. */
const normalize = (path: string): string => {
  const trimmed = path
    .trim()
    .replace(/^\.?\/+/, '')
    .replace(/\/+$/, '');
  return trimmed === '.' ? '' : trimmed;
};

/** Joins path segments with `/`, skipping empty ones. */
const join = (...parts: readonly string[]): string =>
  parts.map(normalize).filter(Boolean).join('/');

/** A directory pattern as a glob: captures such as `:name` become `*`. */
const toGlob = (pattern: string): string =>
  normalize(pattern)
    .split('/')
    .map((segment) => (segment.startsWith(':') ? '*' : segment))
    .join('/');

/** A string or a list, as a list. */
const toList = (value: string | readonly string[]): readonly string[] =>
  typeof value === 'string' ? [value] : value;

export const PathUtil = {
  join,
  normalize,
  toGlob,
  toList,
};
