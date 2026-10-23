import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'pathe';

const CACHE_DIRECTORY = 'node_modules/.cache/lanelint';

const require = createRequire(import.meta.url);

/** The installed version of a package, or `unknown`. */
const versionOf = (name: string): string => {
  try {
    return (require(`${name}/package.json`) as { version: string }).version;
  } catch {
    return 'unknown';
  }
};

/** Whether the project can keep caches between runs: only with `node_modules` at its root. */
const isAvailable = (root: string): boolean => existsSync(join(root, 'node_modules'));

/** A cache file written by this version, or `undefined` when it is missing, broken, or old. */
const read = async <T extends { readonly version: string }>(
  root: string,
  name: string,
  version: string,
): Promise<T | undefined> => {
  try {
    const file = JSON.parse(await readFile(join(root, CACHE_DIRECTORY, name), 'utf8')) as T;
    return file.version === version ? file : undefined;
  } catch {
    return undefined;
  }
};

/** Writes a cache file atomically, so concurrent runs never read half a file. */
const write = async (root: string, name: string, content: unknown): Promise<void> => {
  const directory = join(root, CACHE_DIRECTORY);
  const path = join(directory, name);
  try {
    await mkdir(directory, { recursive: true });
    const temporary = `${path}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(content));
    await rename(temporary, path);
  } catch {
    // A cache that cannot be written only makes the next run slower.
  }
};

export const CacheFileService = {
  isAvailable,
  read,
  versionOf,
  write,
};
