import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Change, ChangeStatus } from '../models/changes.ts';
import { UsageError } from '../errors.ts';

const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

export interface Repository {
  /** Path of the project root inside the repository, ending with `/`, or empty at the top. */
  readonly prefix: string;
  /** Commit of the base ref, or the empty tree when `HEAD` has no commits yet. */
  readonly commit: string;
  readonly ref: string;
}

const execFileAsync = promisify(execFile);

const run = async (root: string, args: readonly string[], input?: string): Promise<Buffer> => {
  const child = execFileAsync('git', ['-c', 'core.quotepath=off', ...args], {
    cwd: root,
    encoding: 'buffer',
    maxBuffer: 1 << 30,
  });
  if (input !== undefined) {
    child.child.stdin?.end(input);
  }
  return (await child).stdout;
};

/**
 * The repository and base commit in one git call, since spawning git dominates small runs.
 * Returns `undefined` outside a repository. Throws `UsageError` for an unknown ref.
 */
const repository = async (root: string, ref: string): Promise<Repository | undefined> => {
  let output: string;
  try {
    output = (
      await run(root, ['rev-parse', '--show-prefix', '--verify', '--quiet', `${ref}^{commit}`])
    ).toString('utf8');
  } catch (error) {
    const { code, stdout } = error as { code?: unknown; stdout?: Buffer };
    if (code !== 1) {
      return undefined;
    }
    if (ref !== 'HEAD') {
      throw new UsageError(`Unknown git ref "${ref}".`);
    }
    return { prefix: stdout?.toString('utf8').split('\n')[0] ?? '', commit: EMPTY_TREE, ref };
  }
  const [prefix = '', commit = EMPTY_TREE] = output.split('\n');
  return { prefix, commit, ref };
};

const statusOf = (code: string): ChangeStatus => {
  if (code.includes('?') || code.startsWith('A')) {
    return 'added';
  }
  if (code.includes('D')) {
    return 'deleted';
  }
  if (code.startsWith('R')) {
    return 'renamed';
  }
  return 'modified';
};

const untrackedFiles = async (root: string): Promise<string[]> =>
  (await run(root, ['ls-files', '--others', '--exclude-standard', '-z']))
    .toString('utf8')
    .split('\0')
    // Nested repositories are listed as directories, with a trailing slash.
    .filter((path) => path && !path.endsWith('/'));

/**
 * Files under the root that differ from the base ref, including untracked files: `git diff`
 * against the base commit plus the untracked files, which callers may already have.
 * Paths are root-relative.
 */
const changes = async (
  root: string,
  repo: Repository,
  untracked: Promise<readonly string[]> = untrackedFiles(root),
): Promise<Change[]> => {
  const [diff, others] = await Promise.all([
    run(root, ['diff', '--name-status', '-z', '-M', '--relative', repo.commit]),
    untracked,
  ]);
  const tokens = diff.toString('utf8').split('\0');
  const result: Change[] = [];
  for (let index = 0; index < tokens.length - 1;) {
    const code = tokens[index++] ?? '';
    if (code.startsWith('R') || code.startsWith('C')) {
      const previousPath = tokens[index++] ?? '';
      const path = tokens[index++] ?? '';
      result.push(
        code.startsWith('R')
          ? { path, status: 'renamed', previousPath }
          : { path, status: 'added' },
      );
    } else {
      result.push({ path: tokens[index++] ?? '', status: statusOf(code) });
    }
  }
  result.push(...others.map((path) => ({ path, status: 'added' as const })));
  return result;
};

/** Contents of root-relative paths at the base commit. Missing files map to `undefined`. */
const readAtRef = async (
  root: string,
  repo: Repository,
  paths: readonly string[],
): Promise<Map<string, string | undefined>> => {
  const contents = new Map<string, string | undefined>();
  if (repo.commit === EMPTY_TREE || !paths.length) {
    for (const path of paths) {
      contents.set(path, undefined);
    }
    return contents;
  }
  const output = await run(
    root,
    ['cat-file', '--batch'],
    paths.map((path) => `${repo.commit}:./${path}`).join('\n') + '\n',
  );
  let offset = 0;
  for (const path of paths) {
    const headerEnd = output.indexOf(10, offset);
    const header = output.toString('utf8', offset, headerEnd);
    offset = headerEnd + 1;
    const [, type, size] = header.split(' ');
    if (type !== 'blob' || size === undefined) {
      contents.set(path, undefined);
      continue;
    }
    const length = Number(size);
    contents.set(path, output.toString('utf8', offset, offset + length));
    offset += length + 1;
  }
  return contents;
};

export interface WorkingFiles {
  /** Root-relative paths of tracked files that exist and of untracked files git does not ignore, sorted. */
  readonly paths: readonly string[];
  /** Untracked files that git does not ignore. */
  readonly untracked: readonly string[];
  /**
   * Blob hashes of files whose working copy matches the index. Files that differ, conflict,
   * or are not regular files are left out, so their content must be read.
   */
  readonly hashes: ReadonlyMap<string, string>;
}

/** The files git knows about under the root, from the index and the untracked files. */
const workingFiles = async (
  root: string,
  untracked: Promise<readonly string[]> = untrackedFiles(root),
): Promise<WorkingFiles> => {
  const [staged, modified, others] = await Promise.all([
    run(root, ['ls-files', '--stage', '-z']),
    run(root, ['diff-files', '--name-status', '--relative', '-z']),
    untracked,
  ]);
  const dirty = new Set<string>();
  const deleted = new Set<string>();
  const tokens = modified.toString('utf8').split('\0');
  for (let index = 0; index < tokens.length - 1; index += 2) {
    const path = tokens[index + 1] ?? '';
    dirty.add(path);
    if (tokens[index]?.startsWith('D')) {
      deleted.add(path);
    }
  }
  const paths = new Set<string>(others);
  const hashes = new Map<string, string>();
  for (const entry of staged.toString('utf8').split('\0')) {
    // <mode> <hash> <stage>\t<path>
    const tab = entry.indexOf('\t');
    const [mode, hash, stage] = entry.slice(0, tab).split(' ');
    const path = entry.slice(tab + 1);
    // Submodules (mode 160000) are separate repositories, not files of this one.
    if (tab <= 0 || mode === '160000' || deleted.has(path)) {
      continue;
    }
    paths.add(path);
    if (hash && stage === '0' && mode?.startsWith('100') && !dirty.has(path)) {
      hashes.set(path, hash);
    }
  }
  return { paths: [...paths].sort(), untracked: others, hashes };
};

export const GitService = {
  changes,
  readAtRef,
  repository,
  untrackedFiles,
  workingFiles,
};
