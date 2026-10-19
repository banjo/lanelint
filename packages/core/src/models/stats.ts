/** How much work a check did. Used to test that pilotlint only does the work its rules need. */
export interface WorkStats {
  /** Files read from the working tree or from git. Each file is read once, even with `--new`. */
  filesRead: number;
  /** Files parsed. Unchanged files are parsed once, even with `--new`. */
  filesParsed: number;
  /** Files whose module info came from the cache of an earlier run instead of being parsed. */
  modulesFromCache: number;
  /** Specifiers resolved. Each specifier is resolved once per directory, even with `--new`. */
  importsResolved: number;
}
