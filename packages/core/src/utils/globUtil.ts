import picomatch from 'picomatch';

type Matcher = (path: string) => boolean;

const matchers = new Map<string, Matcher>();

const toList = (patterns: string | readonly string[]): readonly string[] =>
  typeof patterns === 'string' ? [patterns] : patterns;

/** Matches project-relative paths. An empty pattern list matches nothing. */
const matcher = (patterns: string | readonly string[]): Matcher => {
  const list = toList(patterns);
  const key = list.join('\0');
  let match = matchers.get(key);
  if (!match) {
    match = list.length ? picomatch([...list], { dot: true }) : () => false;
    matchers.set(key, match);
  }
  return match;
};

const matches = (path: string, patterns: string | readonly string[]): boolean =>
  matcher(patterns)(path);

/** Matches a file or directory name, or the full path when the pattern contains `/`. */
const matchesName = (path: string, name: string, pattern: string): boolean =>
  pattern.includes('/') ? matches(path, pattern) : matches(name, pattern);

export const GlobUtil = {
  matcher,
  matches,
  matchesName,
  toList,
};
