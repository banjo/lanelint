import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'pathe';
import type { ModuleInfo } from '../models/module.ts';

/** Bump when `ModuleInfo`, parse errors, or how they are computed change. */
const FORMAT = 1;
const CACHE_DIRECTORY = 'node_modules/.cache/pilotlint';
const CACHE_FILE = 'modules.json';

export interface CachedModule {
  readonly module: ModuleInfo;
  readonly errors: readonly { readonly message: string; readonly line: number }[];
}

/** Module info by content, kept between runs. */
export interface ModuleCache {
  get(key: string): CachedModule | undefined;
  set(key: string, value: CachedModule): void;
  /** Writes new entries to disk, keeping at most `limit` entries. */
  save(limit: number): Promise<void>;
}

interface CacheFile {
  readonly version: string;
  readonly entries: Record<string, CachedModule>;
}

const require = createRequire(import.meta.url);

const versionOf = (name: string): string => {
  try {
    return (require(`${name}/package.json`) as { version: string }).version;
  } catch {
    return 'unknown';
  }
};

const VERSION = `${FORMAT}:${versionOf('@pilotlint/core')}:${versionOf('oxc-parser')}`;

/** The key of a file's content: its git blob hash and extension, since the extension decides how it parses. */
const keyOf = (hash: string, extension: string): string => `${hash}${extension}`;

/** The git blob hash of a text, the same hash `git ls-files -s` shows. */
const hashOf = (text: string): string => {
  const content = Buffer.from(text, 'utf8');
  return createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex');
};

const memory = (): ModuleCache => {
  const entries = new Map<string, CachedModule>();
  return {
    get: (key) => entries.get(key),
    set: (key, value) => void entries.set(key, value),
    save: async () => {},
  };
};

const readCacheFile = async (path: string): Promise<Record<string, CachedModule>> => {
  try {
    const file = JSON.parse(await readFile(path, 'utf8')) as Partial<CacheFile>;
    return file.version === VERSION && file.entries && typeof file.entries === 'object'
      ? file.entries
      : {};
  } catch {
    return {};
  }
};

/**
 * The cache in `node_modules/.cache/pilotlint` of the project root. Without `node_modules` there,
 * the cache lives only for one run.
 */
const load = async (root: string): Promise<ModuleCache> => {
  if (!existsSync(join(root, 'node_modules'))) {
    return memory();
  }
  const directory = join(root, CACHE_DIRECTORY);
  const path = join(directory, CACHE_FILE);
  const entries = new Map(Object.entries(await readCacheFile(path)));
  const used = new Set<string>();
  let dirty = false;
  return {
    get: (key) => {
      const entry = entries.get(key);
      if (entry) {
        used.add(key);
      }
      return entry;
    },
    set: (key, value) => {
      entries.set(key, value);
      used.add(key);
      dirty = true;
    },
    async save(limit) {
      if (!dirty) {
        return;
      }
      // Entries for old file contents pile up; when there are too many, keep the ones used now.
      const kept =
        entries.size > limit ? [...entries].filter(([key]) => used.has(key)) : [...entries];
      const file: CacheFile = { version: VERSION, entries: Object.fromEntries(kept) };
      try {
        await mkdir(directory, { recursive: true });
        const temporary = `${path}.${process.pid}.tmp`;
        await writeFile(temporary, JSON.stringify(file));
        await rename(temporary, path);
      } catch {
        // A cache that cannot be written only makes the next run slower.
      }
    },
  };
};

export const ModuleCacheService = {
  hashOf,
  keyOf,
  load,
  memory,
};
