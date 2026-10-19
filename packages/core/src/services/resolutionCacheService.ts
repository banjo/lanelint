import { createHash } from 'node:crypto';
import { statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'pathe';
import { CacheFileService } from './cacheFileService.ts';

/** Bump when resolver options or how resolutions are stored change. */
const FORMAT = 1;
const CACHE_FILE = 'resolutions.json';
const VERSION = `${FORMAT}:${CacheFileService.versionOf('@pilotlint/core')}:${CacheFileService.versionOf('oxc-resolver')}`;

/** Files that change what an import resolves to, besides the files that exist. */
const RESOLUTION_INPUT =
  /^(?:(?:tsconfig|jsconfig)(?:\..*)?\.json|package\.json|pnpm-workspace\.yaml|pnpm-lock\.yaml|package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|bun\.lockb?)$/;
const ANCESTOR_FILES = [
  'tsconfig.json',
  'jsconfig.json',
  'package.json',
  'pnpm-workspace.yaml',
  'pnpm-lock.yaml',
  'package-lock.json',
  'npm-shrinkwrap.json',
  'yarn.lock',
  'bun.lock',
  'bun.lockb',
];

/** A resolved path, `null` when nothing was found, or `true` for a builtin module. */
type Stored = string | null | true;

interface CacheFile {
  readonly version: string;
  readonly fingerprint: string;
  readonly entries: Record<string, Stored>;
}

export type CachedResolution = { readonly builtin: true } | { readonly path: string } | null;

/** Resolutions kept between runs, valid while the files that decide them are the same. */
export interface ResolutionCache {
  /** The cached resolution of a specifier from a directory, or `undefined` when not cached. */
  get(directory: string, specifier: string): CachedResolution | undefined;
  set(directory: string, specifier: string, resolution: CachedResolution): void;
  save(): Promise<void>;
}

const stamp = (path: string): string => {
  try {
    const stats = statSync(path);
    return `${stats.size}:${stats.mtimeMs}`;
  } catch {
    return '-';
  }
};

/**
 * What resolutions depend on: the project files, and the size and modification time of
 * tsconfig, package.json, and lockfiles in the project and the directories above it, and of
 * `node_modules`. Editing the content of a source file keeps it the same.
 */
const fingerprintOf = (root: string, paths: readonly string[]): string => {
  const hash = createHash('sha1').update(paths.join('\0'));
  for (const path of paths) {
    if (RESOLUTION_INPUT.test(basename(path))) {
      hash.update(`\0${path}:${stamp(join(root, path))}`);
    }
  }
  for (let directory = dirname(root); ; directory = dirname(directory)) {
    for (const name of ANCESTOR_FILES) {
      hash.update(`\0${directory}/${name}:${stamp(join(directory, name))}`);
    }
    if (dirname(directory) === directory) {
      break;
    }
  }
  for (const name of ANCESTOR_FILES) {
    hash.update(`\0./${name}:${stamp(join(root, name))}`);
  }
  hash.update(`\0node_modules:${stamp(join(root, 'node_modules'))}`);
  return hash.digest('hex');
};

const memory = (): ResolutionCache => ({
  get: () => undefined,
  set: () => {},
  save: async () => {},
});

/**
 * The resolutions in `node_modules/.cache/pilotlint` of the project root, if they were made for
 * the same project files. Without `node_modules` there, nothing is kept between runs.
 */
const load = async (root: string, paths: readonly string[]): Promise<ResolutionCache> => {
  if (!CacheFileService.isAvailable(root)) {
    return memory();
  }
  const fingerprint = fingerprintOf(root, paths);
  const file = await CacheFileService.read<CacheFile>(root, CACHE_FILE, VERSION);
  const entries = new Map(
    Object.entries(file?.fingerprint === fingerprint ? (file.entries ?? {}) : {}),
  );
  let dirty = false;
  const keyOf = (directory: string, specifier: string) =>
    `${relative(root, directory)}\0${specifier}`;
  return {
    get(directory, specifier) {
      const stored = entries.get(keyOf(directory, specifier));
      if (stored === undefined) {
        return undefined;
      }
      return stored === true
        ? { builtin: true }
        : stored === null
          ? null
          : { path: resolve(root, stored) };
    },
    set(directory, specifier, resolution) {
      entries.set(
        keyOf(directory, specifier),
        resolution === null
          ? null
          : 'builtin' in resolution
            ? true
            : relative(root, resolution.path),
      );
      dirty = true;
    },
    async save() {
      if (dirty) {
        const content: CacheFile = {
          version: VERSION,
          fingerprint,
          entries: Object.fromEntries(entries),
        };
        await CacheFileService.write(root, CACHE_FILE, content);
      }
    },
  };
};

export const ResolutionCacheService = {
  fingerprintOf,
  load,
  memory,
};
