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
const baseImports = Object.keys(CHANGES).reduce(
  (count, path) => count + (project[path]?.match(/^import /gm)?.length ?? 0),
  0,
);

describe('work', () => {
  let fixture: Fixture;
  let full: WorkStats;

  beforeAll(() => {
    fixture = createFixture('feature-folders', project);
    full = statsOf(fixture);
    fixture.write(CHANGES);
  });

  afterAll(() => fixture.remove());

  it('reads and parses each source file once in a full check', () => {
    expect(full.filesParsed).toBeGreaterThan(40);
    expect(full.filesRead).toBeGreaterThanOrEqual(full.filesParsed);
    expect(full.importsResolved).toBeGreaterThan(full.filesParsed);
  });

  it('reads and parses only the changed files when no rule needs the whole project', () => {
    expect(statsOf(fixture, '--changed', '--config', 'fast.config.ts')).toEqual({
      filesRead: changedFiles,
      filesParsed: changedFiles,
      importsResolved: 0,
    });
  });

  it('also reads the base versions of the changed files with --new', () => {
    expect(statsOf(fixture, '--changed', '--new', '--config', 'fast.config.ts')).toEqual({
      filesRead: 2 * changedFiles,
      filesParsed: 2 * changedFiles,
      importsResolved: baseImports,
    });
  });

  it('builds the import graph once when a rule needs the whole project', () => {
    expect(statsOf(fixture, '--changed')).toEqual({
      ...full,
      importsResolved: full.importsResolved - baseImports,
    });
  });

  it('parses unchanged files once with --new', () => {
    const stats = statsOf(fixture, '--changed', '--new');
    expect(stats.filesParsed).toBe(full.filesParsed + changedFiles);
    expect(stats.filesRead).toBeLessThanOrEqual(2 * full.filesRead);
    expect(stats.importsResolved).toBeLessThanOrEqual(2 * full.importsResolved);
  });
});
