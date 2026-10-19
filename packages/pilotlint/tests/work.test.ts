import type { WorkStats } from '@pilotlint/core';
import { afterAll, beforeAll, describe, expect, it } from 'vite-plus/test';
import { createFixture, type Fixture } from './fixture.ts';
import { CHANGES, generateProject } from './generatedProject.ts';

// Performance comes from doing only the work the rules need, so this test counts work instead
// of measuring time, which depends on the machine. `pnpm bench` measures time.

interface Report {
  readonly summary: { readonly stats: WorkStats };
  readonly findings: readonly { readonly identity: string }[];
}

const reportOf = (fixture: Fixture, args: readonly string[]): Report => {
  const result = fixture.run('check', ...args, '--format', 'json', '--fail-on', 'never');
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout);
  }
  return JSON.parse(result.stdout) as Report;
};

/** Work without the cache between runs, so each run starts from nothing. */
const statsOf = (fixture: Fixture, ...args: string[]): WorkStats =>
  reportOf(fixture, [...args, '--no-cache']).summary.stats;

const cachedStatsOf = (fixture: Fixture, ...args: string[]): WorkStats =>
  reportOf(fixture, args).summary.stats;

const identitiesOf = (fixture: Fixture, ...args: string[]) =>
  reportOf(fixture, args).findings.map((finding) => finding.identity);

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
      modulesFromCache: 0,
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

describe('cache between runs', () => {
  let fixture: Fixture;
  let first: WorkStats;

  beforeAll(() => {
    fixture = createFixture('feature-folders', project);
    first = cachedStatsOf(fixture);
    fixture.write(CHANGES);
  });

  afterAll(() => fixture.remove());

  it('parses everything on the first run', () => {
    expect(first.modulesFromCache).toBe(0);
    expect(first.filesParsed).toBeGreaterThan(40);
  });

  it('reads and parses only the changed files on the next run', () => {
    const uncached = statsOf(fixture, '--changed');
    const cached = cachedStatsOf(fixture, '--changed');
    expect(cached.filesParsed).toBe(changedFiles);
    expect(cached.modulesFromCache).toBe(uncached.filesParsed - changedFiles);
    // The changed files, and the config, which pilotlint/config-changed reads.
    expect(cached.filesRead).toBeLessThanOrEqual(changedFiles + 1);
  });

  it('takes the base versions of changed files from the cache with --new', () => {
    const cached = cachedStatsOf(fixture, '--changed', '--new');
    expect(cached.filesParsed).toBe(0);
  });

  it('finds the same problems as without the cache, including in files edited since', () => {
    fixture.write({
      'src/common/domain-0/models/model0.ts':
        "import { component01 } from '../../../features/feature-1/components/component0.ts';\nexport const model00 = component01;\n",
    });
    const cached = identitiesOf(fixture, '--changed');
    expect(cached).toEqual(identitiesOf(fixture, '--changed', '--no-cache'));
    expect(cached.some((identity) => identity.startsWith('boundaries/allowed-imports|'))).toBe(
      true,
    );
  });
});

describe('rules on part of the project', () => {
  let fixture: Fixture;

  beforeAll(() => {
    fixture = createFixture('feature-folders', {
      ...project,
      'scoped.config.ts': `import boundaries from '@pilotlint/plugin-boundaries';
import conventions from '@pilotlint/plugin-conventions';
import { defineConfig } from 'pilotlint';

export default defineConfig({
  elements: [{ type: 'domain', pattern: 'src/common/:name' }],
  plugins: [boundaries, conventions],
  rules: { 'boundaries/no-cycles': 'error' },
  overrides: [
    { files: ['src/common/domain-0/**'], rules: { 'conventions/no-suppressions': 'error' } },
  ],
});
`,
    });
    cachedStatsOf(fixture, '--config', 'scoped.config.ts');
  });

  afterAll(() => fixture.remove());

  it('reads only the files an AST rule is on, when the rest comes from the cache', () => {
    const domainFiles = Object.keys(project).filter((path) =>
      path.startsWith('src/common/domain-0/'),
    ).length;
    const stats = cachedStatsOf(fixture, '--config', 'scoped.config.ts');
    expect(stats.filesParsed).toBe(0);
    // The files of domain-0, and the config, which pilotlint/config-changed reads.
    expect(stats.filesRead).toBeGreaterThanOrEqual(domainFiles);
    expect(stats.filesRead).toBeLessThanOrEqual(domainFiles + 1);
  });
});
