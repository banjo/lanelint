import type { WorkStats } from '@pilotlint/core';
import { afterAll, beforeAll, describe, expect, it } from 'vite-plus/test';
import { createFixture, type Fixture } from './fixture.ts';
import { CHANGES, generateProject } from './generatedProject.ts';

// Performance comes from doing only the work the rules need, so this test counts work instead
// of measuring time, which depends on the machine. `pnpm bench` measures time.

interface Report {
  readonly summary: { readonly stats: WorkStats };
}

const statsOf = (fixture: Fixture, ...args: string[]): WorkStats => {
  const result = fixture.run('check', ...args, '--format', 'json', '--fail-on', 'never');
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout);
  }
  return (JSON.parse(result.stdout) as Report).summary.stats;
};

const project = generateProject({ features: 4, filesPerFeature: 6, domains: 3, filesPerDomain: 4 });
const changedFiles = Object.keys(CHANGES).length;
// The changes remove the imports of the changed files; their base versions still have them.
// Resolutions are counted once per directory and specifier, so this is an upper bound.
const baseImports = Object.keys(CHANGES).reduce(
  (count, path) => count + (project[path]?.match(/^import /gm)?.length ?? 0),
  0,
);

describe('work', () => {
  let fixture: Fixture;
  let full: WorkStats;

  beforeAll(() => {
    fixture = createFixture('feature-folders', project);
    fixture.write(CHANGES);
    full = statsOf(fixture);
  });

  afterAll(() => fixture.remove());

  it('reads and parses each source file once in a full check', () => {
    expect(full.filesParsed).toBeGreaterThan(40);
    expect(full.filesRead).toBeGreaterThanOrEqual(full.filesParsed);
    expect(full.importsResolved).toBeGreaterThan(0);
  });

  it('reads and parses only the changed files when no rule needs the whole project', () => {
    expect(statsOf(fixture, '--changed', '--config', 'fast.config.ts')).toEqual({
      filesRead: changedFiles,
      filesParsed: changedFiles,
      importsResolved: 0,
    });
  });

  it('also reads the base versions of the changed files with --new', () => {
    const stats = statsOf(fixture, '--changed', '--new', '--config', 'fast.config.ts');
    expect(stats.filesRead).toBe(2 * changedFiles);
    expect(stats.filesParsed).toBe(2 * changedFiles);
    expect(stats.importsResolved).toBeGreaterThan(0);
    expect(stats.importsResolved).toBeLessThanOrEqual(baseImports);
  });

  it('builds the import graph once when a rule needs the whole project', () => {
    expect(statsOf(fixture, '--changed')).toEqual(full);
  });

  it('reads, parses, and resolves unchanged files once with --new', () => {
    const stats = statsOf(fixture, '--changed', '--new');
    expect(stats.filesRead).toBe(full.filesRead + changedFiles);
    expect(stats.filesParsed).toBe(full.filesParsed + changedFiles);
    expect(stats.importsResolved).toBeLessThanOrEqual(full.importsResolved + baseImports);
  });
});
