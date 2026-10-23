import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { RULE_DOCS_MARKER, type RuleDocsFile } from '@lanelint/core';

export interface RuleDocsDiff {
  /** Files that are missing or differ, relative to the output directory. */
  readonly changed: readonly string[];
  /** Generated files that are no longer generated, relative to the output directory. */
  readonly removed: readonly string[];
}

const readOrUndefined = (path: string) => readFile(path, 'utf8').catch(() => undefined);

/** Compares generated files with the files in a directory. */
const diff = async (directory: string, files: readonly RuleDocsFile[]): Promise<RuleDocsDiff> => {
  const contents = await Promise.all(
    files.map((file) => readOrUndefined(join(directory, file.path))),
  );
  const changed = files.filter((file, index) => contents[index] !== file.content);
  const generated = new Set(files.map((file) => file.path));
  const existing = await readdir(directory).catch(() => [] as string[]);
  const others = existing.filter((name) => name.endsWith('.md') && !generated.has(name));
  const removed: string[] = [];
  for (const name of others) {
    const content = await readOrUndefined(join(directory, name));
    if (content?.startsWith(RULE_DOCS_MARKER)) {
      removed.push(name);
    }
  }
  return { changed: changed.map((file) => file.path), removed };
};

/** Writes the files that changed and removes generated files that are no longer generated. */
const write = async (directory: string, files: readonly RuleDocsFile[]): Promise<RuleDocsDiff> => {
  const result = await diff(directory, files);
  const changed = new Set(result.changed);
  await mkdir(directory, { recursive: true });
  await Promise.all([
    ...files
      .filter((file) => changed.has(file.path))
      .map((file) => writeFile(join(directory, file.path), file.content)),
    ...result.removed.map((name) => rm(join(directory, name))),
  ]);
  return result;
};

export const RuleDocsService = {
  diff,
  write,
};
