import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'pathe';
import { glob } from 'tinyglobby';
import { DEFAULT_IGNORE } from '../constants/defaults.ts';
import type { Change } from '../models/changes.ts';
import { GlobUtil } from '../utils/globUtil.ts';

/** Every file access goes through a snapshot, so the engine can run on the working tree or a git ref. */
export interface Snapshot {
  readonly root: string;
  /** Root-relative file paths, sorted. */
  readonly paths: readonly string[];
  has(path: string): boolean;
  read(path: string): Promise<string | undefined>;
  readSync(path: string): string | undefined;
}

export interface FileFilter {
  readonly include: readonly string[];
  readonly ignore: readonly string[];
}

const inFilter = (filter: FileFilter) => {
  const include = GlobUtil.matcher(filter.include);
  const ignore = GlobUtil.matcher([...DEFAULT_IGNORE, ...filter.ignore]);
  return (path: string) => include(path) && !ignore(path);
};

const readOrUndefined = async (path: string) => {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return undefined;
  }
};

const readSyncOrUndefined = (path: string) => {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return undefined;
  }
};

const createWorkingTree = async (root: string, filter: FileFilter): Promise<Snapshot> => {
  const paths = (
    await glob([...filter.include], {
      cwd: root,
      ignore: [...DEFAULT_IGNORE, ...filter.ignore],
      dot: true,
      onlyFiles: true,
      expandDirectories: false,
      followSymbolicLinks: false,
    })
  ).sort();
  const set = new Set(paths);
  return {
    root,
    paths,
    has: (path) => set.has(path),
    read: (path) => readOrUndefined(join(root, path)),
    readSync: (path) => readSyncOrUndefined(join(root, path)),
  };
};

/** Paths whose content at the base ref is needed to rebuild it from the working tree. */
const basePathsOf = (changes: readonly Change[]): string[] =>
  changes.flatMap((change) => {
    switch (change.status) {
      case 'added':
        return [];
      case 'renamed':
        return change.previousPath ? [change.previousPath] : [];
      default:
        return [change.path];
    }
  });

/**
 * The working tree with changed paths replaced by their content at a ref.
 * Added files are removed and deleted files are restored.
 */
const createAtRef = (
  working: Snapshot,
  filter: FileFilter,
  changes: readonly Change[],
  contents: ReadonlyMap<string, string | undefined>,
): Snapshot => {
  const accepts = inFilter(filter);
  const set = new Set(working.paths);
  for (const change of changes) {
    if (change.status === 'added' || change.status === 'renamed') {
      set.delete(change.path);
    }
    const previous = change.status === 'renamed' ? change.previousPath : change.path;
    if (
      previous &&
      change.status !== 'added' &&
      contents.get(previous) !== undefined &&
      accepts(previous)
    ) {
      set.add(previous);
    }
  }
  const paths = [...set].sort();
  const read = (path: string) => (contents.has(path) ? contents.get(path) : undefined);
  return {
    root: working.root,
    paths,
    has: (path) => set.has(path),
    read: async (path) =>
      !set.has(path) ? undefined : contents.has(path) ? read(path) : working.read(path),
    readSync: (path) =>
      !set.has(path) ? undefined : contents.has(path) ? read(path) : working.readSync(path),
  };
};

export const SnapshotService = {
  basePathsOf,
  createAtRef,
  createWorkingTree,
};
