import { afterEach, describe, expect, it } from 'vite-plus/test';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createFixture, type Fixture } from './fixture.ts';

const fixtures: Fixture[] = [];
const fixture = (example: string, files?: Record<string, string>) => {
  const created = createFixture(example, files);
  fixtures.push(created);
  return created;
};

afterEach(() => {
  fixtures.splice(0).forEach((created) => created.remove());
});

const violations = {
  'src/features/calendar/hooks/useSlots.ts': [
    '// @ts-ignore',
    "import { BookingPage } from '../../booking/components/bookingPage.ts';",
    '',
    'export default function useSlots() {',
    '  return [BookingPage];',
    '}',
  ].join('\n'),
};

describe('lanelint check', () => {
  it('passes on the example projects', () => {
    for (const example of ['feature-folders', 'monorepo', 'bulletproof-react']) {
      const result = fixture(example).run('check');
      expect(result.stdout).toMatch(/^0 errors, 0 warnings in \d+ files \(\d+ ms\)$/m);
      expect(result.status).toBe(0);
    }
  });

  it('catches the problems of the before example in the README', () => {
    const project = fixture('bulletproof-react', {
      'src/utils.ts': [
        'export const formatPrice = (cents: number) => `$${cents / 100}`;',
        'export default { formatPrice };',
      ].join('\n'),
      'src/types.ts': 'export interface Comment { body: string }',
      'src/helpers/format.ts': 'export const trim = (text: string) => text.trim();',
      'src/utils/format.ts': 'export const FormatUtil = {};',
      'src/utils/stringUtil.ts': 'export const slugify = (text: string) => text;',
      'src/features/discussions/components/discussion-page.tsx': [
        "import { CommentsList } from '../../comments/components/comments-list.tsx';",
        'export const DiscussionPage = () => <CommentsList discussionId="1" />;',
      ].join('\n'),
      'src/components/ui/use-comments.ts': [
        "import { getComments } from '../../features/comments/api/get-comments.ts';",
        'export const useComments = getComments;',
      ].join('\n'),
    });
    const report = JSON.parse(project.run('check', '--format', 'json').stdout) as {
      findings: { ruleId: string; location: { path: string } }[];
    };
    expect(
      report.findings.map((finding) => `${finding.location.path} ${finding.ruleId}`).sort(),
    ).toEqual([
      'src/components/ui/use-comments.ts boundaries/allowed-imports',
      'src/features/discussions/components/discussion-page.tsx boundaries/allowed-imports',
      'src/helpers conventions/forbidden-directories',
      'src/types.ts conventions/forbidden-files',
      'src/utils.ts conventions/forbidden-files',
      'src/utils.ts conventions/no-default-export',
      'src/utils/format.ts conventions/file-name-pattern',
      'src/utils/stringUtil.ts conventions/export-matches-filename',
      'src/utils/stringUtil.ts conventions/export-matches-filename',
    ]);
  });

  it('reports findings with locations, rule ids, and hints, and exits with 1', () => {
    const project = fixture('feature-folders');
    project.write(violations);
    const result = project.run('check', '--changed', '--new');
    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      'src/features/calendar/hooks/useSlots.ts:2 error boundaries/entry-only Import src/features/booking through its entry file, not src/features/booking/components/bookingPage.ts.',
    );
    expect(result.stdout).toContain(
      '  hint: Export what you need from src/features/booking/index.ts and import it from there.',
    );
    expect(result.stdout).toContain(
      'src/features/calendar/hooks/useSlots.ts:1 error conventions/no-suppressions',
    );
    expect(result.stdout).toContain(
      'src/features/calendar/hooks/useSlots.ts:4 error conventions/no-default-export',
    );
    expect(result.stdout).toMatch(/3 errors, 1 warning in 1 file, new since HEAD/);
  });

  it('shows only new findings with --new', () => {
    const project = fixture('feature-folders', violations);
    project.write({
      'src/features/calendar/hooks/useSlots.ts': `\n\n${violations['src/features/calendar/hooks/useSlots.ts']}`,
    });
    const all = project.run('check', '--changed');
    expect(all.stdout).toMatch(/3 errors, 1 warning/);
    const onlyNew = project.run('check', '--changed', '--new');
    expect(onlyNew.stdout).toMatch(/^0 errors, 0 warnings in 1 file, new since HEAD/m);
    expect(onlyNew.status).toBe(0);
  });

  it('limits the report to paths and rules, and respects --fail-on', () => {
    const project = fixture('feature-folders', violations);
    const result = project.run(
      'check',
      'src/features/calendar/hooks',
      '--rule',
      'boundaries/entry-only,conventions/no-default-export',
      '--format',
      'json',
    );
    const report = JSON.parse(result.stdout) as {
      summary: { errors: number };
      findings: { ruleId: string }[];
    };
    expect(report.findings.map((finding) => finding.ruleId)).toEqual([
      'boundaries/entry-only',
      'conventions/no-default-export',
    ]);
    expect(report.summary.errors).toBe(2);
    expect(project.run('check', '--fail-on', 'never').status).toBe(0);
  });

  it('truncates long reports and counts the rest per rule', () => {
    const project = fixture('feature-folders', violations);
    const result = project.run('check', '--max-findings', '1');
    expect(result.stdout).toContain('3 more findings not shown: ');
    expect(result.stdout).toContain('Narrow the run with --rule or a path.');
  });

  it('reports config changes for human review', () => {
    const project = fixture('feature-folders');
    const config = readFileSync(join(project.root, 'lanelint.config.ts'), 'utf8');
    project.write({ 'lanelint.config.ts': `// Relaxed by an agent.\n${config}` });
    const result = project.run('check', '--changed', '--new');
    expect(result.stdout).toContain(
      '(project) warn lanelint/config-changed The lanelint config lanelint.config.ts changed and needs a human review.',
    );
    expect(result.status).toBe(0);
  });

  it('loads TypeScript configs in packages without "type": "module", without warnings', () => {
    const project = fixture('feature-folders', {
      'local/plugin.ts': [
        "import { definePlugin } from 'lanelint';",
        "export default definePlugin({ name: 'local', rules: {} });",
      ].join('\n'),
    });
    const { type: _type, ...manifest } = JSON.parse(
      readFileSync(join(project.root, 'package.json'), 'utf8'),
    ) as Record<string, unknown>;
    const config = readFileSync(join(project.root, 'lanelint.config.ts'), 'utf8');
    project.write({
      'package.json': JSON.stringify(manifest),
      'lanelint.config.ts': config
        .replace(
          "import { defineConfig } from 'lanelint';",
          "$&\nimport local from './local/plugin';",
        )
        .replace('plugins: [', 'plugins: [local, '),
    });
    project.commit();
    const result = project.run('check');
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });

  it('lists files with git: untracked files count, ignored and deleted files do not', () => {
    const project = fixture('feature-folders', {
      '.gitignore': 'src/features/calendar/hooks/\n',
      'src/hooks/useLegacy.ts': '// @ts-ignore\nexport const useLegacy = 1;\n',
    });
    rmSync(join(project.root, 'src/hooks/useLegacy.ts'));
    project.write(violations);
    expect(project.run('check').stdout).toMatch(/^0 errors, 0 warnings/m);

    project.write({ 'src/hooks/useLate.ts': '// @ts-ignore\nexport const useLate = 1;\n' });
    expect(project.run('check').stdout).toContain(
      'src/hooks/useLate.ts:1 error conventions/no-suppressions',
    );
  });

  it('walks the directories with gitignore: false, and outside git', () => {
    const project = fixture('feature-folders', {
      '.gitignore': 'src/features/calendar/hooks/\n',
    });
    project.write(violations);
    const config = readFileSync(join(project.root, 'lanelint.config.ts'), 'utf8');
    project.write({
      'lanelint.config.ts': config.replace('include:', 'gitignore: false,\n  include:'),
    });
    expect(project.run('check').stdout).toContain('src/features/calendar/hooks/useSlots.ts:2');

    project.write({ 'lanelint.config.ts': config });
    rmSync(join(project.root, '.git'), { recursive: true, force: true });
    expect(project.run('check').stdout).toContain('src/features/calendar/hooks/useSlots.ts:2');
  });

  it('exits with 2 on setup problems', () => {
    const project = fixture('feature-folders');
    expect(project.run('check', '--rule', 'nope/rule').status).toBe(2);
    expect(project.run('check', '--base', 'not-a-ref', '--new').stderr).toContain(
      'Unknown git ref "not-a-ref".',
    );
    expect(project.run('check', 'missing/path').stderr).toContain('missing/path does not exist.');
    expect(project.run('check', '--config', 'nope.config.ts').status).toBe(2);
    const badFlag = project.run('check', '--format', 'xml');
    expect(badFlag.status).toBe(2);
    expect(badFlag.stderr).toContain(
      'Invalid value for argument: --format (xml). Expected one of: compact, json.',
    );
    expect(project.run('nope').status).toBe(2);
    project.write({
      'lanelint.config.ts':
        "export default { rules: { 'nope/rule': 'error', 'lanelint/config-changed': 'off' } };",
    });
    const invalid = project.run('check');
    expect(invalid.status).toBe(2);
    expect(invalid.stderr).toContain(
      'Unknown rule "nope/rule". Is the plugin "nope" listed in plugins?',
    );
    expect(invalid.stderr).toContain('"lanelint/config-changed" cannot be turned off.');
  });
});

describe('lanelint describe', () => {
  it('describes the structure and what applies to a path', () => {
    const project = fixture('feature-folders');
    const all = project.run('describe');
    expect(all.status).toBe(0);
    expect(all.stdout).toContain('## Elements');
    expect(all.stdout).toContain('Current: `src/features/booking`, `src/features/calendar`.');
    expect(all.stdout).toContain(
      '### Feature and domain code uses named exports, except message catalogs.',
    );
    const path = project.run('describe', 'src/features/calendar/hooks/useNew.ts');
    expect(path.stdout).toContain('This path does not exist yet.');
    expect(path.stdout).toContain(
      'Part of the **feature** element `src/features/calendar`, at `hooks/useNew.ts`.',
    );
    expect(path.stdout).toContain('`conventions/no-default-export`');
  });

  it('places a directory that does not exist yet in its element', () => {
    const project = fixture('feature-folders');
    const result = project.run('describe', 'src/features/billing');
    expect(result.stdout).toContain('This path does not exist yet.');
    expect(result.stdout).toContain('Part of the **feature** element `src/features/billing`.');
    expect(result.stdout).toContain('`conventions/no-default-export`');
  });
});

describe('lanelint rules', () => {
  it('lists and explains rules', () => {
    const project = fixture('feature-folders');
    const list = project.run('rules', 'list');
    expect(list.stdout).toMatch(
      /^error boundaries\/entry-only +Imports from outside an element must target its entry files\.$/m,
    );
    const explain = project.run('rules', 'explain', 'boundaries/entry-only');
    expect(explain.stdout).toContain('# boundaries/entry-only');
    expect(explain.stdout).toContain(
      'Code outside a feature element imports it only through its entry files.',
    );
    expect(project.run('rules', 'explain', 'nope/rule').status).toBe(2);
  });

  it('writes rule docs, checks them, and removes pages that are no longer generated', () => {
    const project = fixture('feature-folders');
    const docs = (...names: string[]) => join(project.root, 'docs/rules', ...names);

    expect(project.run('rules', 'docs', '--check').status).toBe(1);
    const written = project.run('rules', 'docs');
    expect(written.status).toBe(0);
    expect(written.stdout).toContain('wrote boundaries.md');
    expect(readFileSync(docs('boundaries.md'), 'utf8')).toContain('## entry-only');
    expect(readFileSync(docs('README.md'), 'utf8')).toContain('## [conventions](conventions.md)');

    const upToDate = project.run('rules', 'docs', '--check');
    expect(upToDate.stdout).toContain('The rule docs in docs/rules are up to date.');
    expect(upToDate.status).toBe(0);

    project.write({
      'docs/rules/boundaries.md': 'edited',
      'docs/rules/old.md': '<!-- Generated by `lanelint rules docs`. Do not edit. -->',
      'docs/rules/notes.md': 'Written by hand.',
    });
    const outdated = project.run('rules', 'docs', '--check');
    expect(outdated.status).toBe(1);
    expect(outdated.stdout).toContain('docs/rules/boundaries.md is out of date.');
    expect(outdated.stdout).toContain('docs/rules/old.md is no longer generated.');
    expect(outdated.stdout).not.toContain('notes.md');

    expect(project.run('rules', 'docs').stdout).toContain('wrote boundaries.md, removed old.md');
    expect(existsSync(docs('old.md'))).toBe(false);
    expect(existsSync(docs('notes.md'))).toBe(true);
  });

  it('documents only the plugins passed with --plugin', () => {
    const project = fixture('feature-folders');
    const result = project.run('rules', 'docs', '--out', 'rules', '--plugin', 'changes');
    expect(result.stdout).toBe('Rule docs in rules: wrote README.md, wrote changes.md.\n');
    expect(project.run('rules', 'docs', '--plugin', 'nope').status).toBe(2);
  });
});
