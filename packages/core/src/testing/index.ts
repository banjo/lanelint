import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'pathe';
import { definePlugin } from '../api/definePlugin.ts';
import { resolveConfig } from '../config/resolveConfig.ts';
import { check } from '../engine/check.ts';
import type { Change } from '../models/changes.ts';
import type { PilotlintConfig } from '../models/config.ts';
import type { Finding, Level } from '../models/finding.ts';
import type { AnyRule } from '../models/rule.ts';

export type Files = Readonly<Record<string, string>>;

export interface RuleCase {
  readonly name?: string;
  /** Files of the working tree, relative to the project root. */
  readonly files: Files;
  readonly options?: unknown;
  readonly level?: Exclude<Level, 'off'>;
  /** Config other than plugins and rules, for example elements. */
  readonly config?: Omit<PilotlintConfig, 'plugins' | 'rules' | 'extends' | 'root'>;
  /** Files at the base ref. When set, the fixture is a git repository with these files committed. */
  readonly base?: Files;
  readonly changes?: readonly Change[];
  readonly paths?: readonly string[];
  readonly changed?: boolean;
  readonly onlyNew?: boolean;
}

export interface ExpectedFinding {
  readonly path: string;
  readonly line?: number;
  readonly message?: string | RegExp;
  readonly hint?: string | RegExp;
}

export interface InvalidRuleCase extends RuleCase {
  readonly findings: readonly ExpectedFinding[];
}

const git = (cwd: string, args: readonly string[]) =>
  execFileSync('git', [...args], { cwd, stdio: 'pipe' });

const write = (root: string, files: Files) => {
  for (const [path, content] of Object.entries(files)) {
    const absolute = join(root, path);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, content);
  }
};

/** Writes a fixture to a temporary directory, runs one rule on it, and returns its findings. */
export async function runRule(rule: AnyRule, testCase: RuleCase): Promise<Finding[]> {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'pilotlint-')));
  try {
    if (testCase.base) {
      write(root, testCase.base);
      git(root, ['init', '--quiet']);
      git(root, ['add', '-A']);
      git(root, [
        '-c',
        'user.name=pilotlint',
        '-c',
        'user.email=pilotlint@example.com',
        'commit',
        '--quiet',
        '--allow-empty',
        '-m',
        'base',
      ]);
      for (const path of Object.keys(testCase.base)) {
        if (!(path in testCase.files)) {
          rmSync(join(root, path));
        }
      }
    }
    write(root, testCase.files);
    const plugin = definePlugin({ name: 'test', rules: { rule } });
    const level = testCase.level ?? rule.meta.severity;
    const config = await resolveConfig(
      {
        ...testCase.config,
        plugins: [plugin],
        rules: {
          'pilotlint/stale-config': 'off',
          'test/rule': testCase.options === undefined ? level : [level, testCase.options],
        },
      } as PilotlintConfig,
      { directory: root },
    );
    const result = await check({
      config,
      paths: testCase.paths,
      changed: testCase.changed,
      onlyNew: testCase.onlyNew,
      changes: testCase.changes,
    });
    return result.findings.filter((finding) => finding.ruleId === 'test/rule');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

interface TestFramework {
  describe(name: string, body: () => void): void;
  it(name: string, body: () => Promise<void>): void;
  expect(value: unknown): { toEqual(expected: unknown): void };
}

const summarize = (findings: readonly Finding[], expected: readonly ExpectedFinding[]) =>
  findings.map((finding, index) => {
    const wanted = expected[index];
    const summary: Record<string, unknown> = { path: finding.location.path };
    if (wanted?.line !== undefined) {
      summary.line = finding.location.line;
    }
    for (const key of ['message', 'hint'] as const) {
      const pattern = wanted?.[key];
      const actual = finding[key];
      if (pattern !== undefined) {
        summary[key] =
          pattern instanceof RegExp && actual && pattern.test(actual) ? pattern : actual;
      }
    }
    return summary;
  });

/**
 * Generates test cases for a rule. Pass `describe`, `it`, and `expect` from Vitest
 * or any framework with the same shape.
 */
export function testRule(
  name: string,
  rule: AnyRule,
  cases: { readonly valid?: readonly RuleCase[]; readonly invalid?: readonly InvalidRuleCase[] },
  framework: TestFramework,
): void {
  framework.describe(name, () => {
    cases.valid?.forEach((testCase, index) => {
      framework.it(`valid: ${testCase.name ?? index + 1}`, async () => {
        framework.expect(summarize(await runRule(rule, testCase), [])).toEqual([]);
      });
    });
    cases.invalid?.forEach((testCase, index) => {
      framework.it(`invalid: ${testCase.name ?? index + 1}`, async () => {
        const findings = await runRule(rule, testCase);
        framework
          .expect(summarize(findings, testCase.findings))
          .toEqual(testCase.findings.map((finding) => ({ ...finding })));
      });
    });
  });
}
