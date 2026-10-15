export type ChangeStatus = 'added' | 'modified' | 'deleted' | 'renamed';

export interface Change {
  readonly path: string;
  readonly status: ChangeStatus;
  /** Path before a rename. */
  readonly previousPath?: string;
}

export interface ChangeSet {
  /** False outside a git repository. Reading it does not count as needing git. */
  readonly available: boolean;
  readonly base: string;
  readonly files: readonly Change[];
  has(path: string): boolean;
  get(path: string): Change | undefined;
  matching(patterns: string | readonly string[]): readonly Change[];
}
