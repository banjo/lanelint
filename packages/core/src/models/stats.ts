/** How much work a check did. Used to test that pilotlint only does the work its rules need. */
export interface WorkStats {
  /** Files read from the working tree or from git. */
  filesRead: number;
  /** Files parsed. Unchanged files are parsed once, even with `--new`. */
  filesParsed: number;
  /** Import specifiers resolved to a target. */
  importsResolved: number;
}
