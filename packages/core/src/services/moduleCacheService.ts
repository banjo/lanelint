import { createHash } from 'node:crypto';
import type { ModuleInfo } from '../models/module.ts';
import { CacheFileService } from './cacheFileService.ts';

/** Bump when `ModuleInfo`, parse errors, or how they are computed change. */
const FORMAT = 1;
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

const VERSION = `${FORMAT}:${CacheFileService.versionOf('@lanelint/core')}:${CacheFileService.versionOf('oxc-parser')}`;

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

/**
 * The cache in `node_modules/.cache/lanelint` of the project root. Without `node_modules` there,
 * the cache lives only for one run.
 */
const load = async (root: string): Promise<ModuleCache> => {
  if (!CacheFileService.isAvailable(root)) {
    return memory();
  }
  const file = await CacheFileService.read<CacheFile>(root, CACHE_FILE, VERSION);
  const entries = new Map(Object.entries(file?.entries ?? {}));
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
      const content: CacheFile = { version: VERSION, entries: Object.fromEntries(kept) };
      await CacheFileService.write(root, CACHE_FILE, content);
    },
  };
};

export const ModuleCacheService = {
  hashOf,
  keyOf,
  load,
  memory,
};
