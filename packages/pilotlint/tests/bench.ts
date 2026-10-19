// Measures how long checks take on about 1,000 files. It prints the times and never fails on
// them, since they depend on the machine. Run with `pnpm bench`.
import { createFixture, type Fixture } from './fixture.ts';
import { CHANGES, generateProject, LARGE } from './generatedProject.ts';

const RUNS = 5;

interface Report {
  readonly summary: { readonly durationMs: number; readonly files: number };
}

const engineMs = (fixture: Fixture, args: readonly string[]): number => {
  const result = fixture.run('check', ...args, '--format', 'json', '--fail-on', 'never');
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout);
  }
  return (JSON.parse(result.stdout) as Report).summary.durationMs;
};

const measure = (fixture: Fixture, name: string, args: readonly string[]) => {
  const times = Array.from({ length: RUNS }, () => engineMs(fixture, args)).sort((a, b) => a - b);
  const median = times[Math.floor(RUNS / 2)] ?? 0;
  console.log(
    `${name.padEnd(36)} median ${String(median).padStart(5)} ms   fastest ${String(times[0]).padStart(5)} ms`,
  );
};

const fixture = createFixture('feature-folders', generateProject(LARGE));
try {
  engineMs(fixture, []);
  measure(fixture, 'full check', []);
  fixture.write(CHANGES);
  measure(fixture, '--changed, file rules', ['--changed', '--config', 'fast.config.ts']);
  measure(fixture, '--changed', ['--changed']);
  measure(fixture, '--changed --new', ['--changed', '--new']);
} finally {
  fixture.remove();
}
