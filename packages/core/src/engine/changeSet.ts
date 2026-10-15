import type { Change, ChangeSet } from '../models/changes.ts';
import { GlobUtil } from '../utils/globUtil.ts';

export interface ChangeState {
  readonly available: boolean;
  readonly changes: readonly Change[];
}

/** A change set that loads on first use and reports reads made while git is unavailable. */
export function createChangeSet(
  base: string,
  load: () => ChangeState,
  onUnavailable: () => void,
): ChangeSet {
  const files = () => {
    const state = load();
    if (!state.available) {
      onUnavailable();
    }
    return state.changes;
  };
  return {
    base,
    get available() {
      return load().available;
    },
    get files() {
      return files();
    },
    has: (path) => files().some((change) => change.path === path),
    get: (path) => files().find((change) => change.path === path),
    matching: (patterns) => files().filter((change) => GlobUtil.matches(change.path, patterns)),
  };
}
