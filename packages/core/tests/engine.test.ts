import { describe, expect, it } from 'vite-plus/test';
import * as v from 'valibot';
import { definePlugin } from '../src/api/definePlugin.ts';
import { defineRule } from '../src/api/defineRule.ts';
import type { ImportEdge, ModuleInfo } from '../src/models/module.ts';
import { runConfig, runRule } from '../src/testing/index.ts';

const reportFiles = defineRule({
  meta: { description: 'Reports every file.', severity: 'warn' },
  create: (context) => ({
    file(file) {
      const element = file.element;
      context.report({
        at: file,
        message: [
          file.name,
          file.stem,
          file.extension,
          file.isSource ? 'source' : 'other',
          file.isTest ? 'test' : 'code',
          element
            ? `${element.type}:${element.root}:${element.relativePath}:${element.isEntry}`
            : '-',
        ].join(' '),
      });
    },
  }),
});

describe('project model', () => {
  it('describes files and their elements', async () => {
    const findings = await runRule(reportFiles, {
      config: {
        elements: [
          { type: 'feature', pattern: 'src/features/:name' },
          { type: 'shared', pattern: 'src/:name', where: { name: ['hooks'] } },
        ],
      },
      files: {
        'src/features/calendar/index.ts': '',
        'src/features/calendar/hooks/useSlots.test.ts': '',
        'src/hooks/useX.ts': '',
        'src/other/a.css': '',
        'src/features/index.ts': '',
      },
    });
    expect(findings.map((finding) => finding.message)).toEqual([
      'useSlots.test.ts useSlots .ts source test feature:src/features/calendar:hooks/useSlots.test.ts:false',
      'index.ts index .ts source code feature:src/features/calendar:index.ts:true',
      'index.ts index .ts source code -',
      'useX.ts useX .ts source code shared:src/hooks:useX.ts:false',
      'a.css a .css other code -',
    ]);
  });
});

const describeEdge = (edge: ImportEdge) => {
  const target = edge.target;
  const where =
    target.type === 'internal'
      ? target.file.path
      : target.type === 'external'
        ? `${target.package}${target.path ? `/${target.path}` : ''}`
        : target.type === 'builtin'
          ? target.module
          : target.type === 'excluded'
            ? target.path
            : '';
  return `${edge.line} ${edge.syntax}${edge.typeOnly ? ' type' : ''}${edge.reexport ? ' reexport' : ''} ${edge.specifier} -> ${target.type} ${where} [${edge.names.join(',')}]`;
};

const reportEdges = defineRule({
  meta: { description: 'Reports every import.', severity: 'warn' },
  create: (context) => ({
    import(edge) {
      context.report({ at: edge, message: describeEdge(edge) });
    },
  }),
});

describe('import edges', () => {
  it('resolves every kind of import', async () => {
    const findings = await runRule(reportEdges, {
      paths: ['src/index.ts'],
      files: {
        'package.json': JSON.stringify({ name: 'app', type: 'module' }),
        'tsconfig.json': JSON.stringify({
          compilerOptions: { module: 'nodenext', paths: { '@/*': ['./src/*'] } },
        }),
        'node_modules/lib/package.json': JSON.stringify({ name: 'lib', main: 'index.js' }),
        'node_modules/lib/index.js': '',
        'node_modules/lib/sub.js': '',
        'dist/out.js': '',
        'src/index.ts': [
          "import { a, b as c } from './a.ts';",
          "import type { T } from './types';",
          "import def, * as ns from '@/a.js';",
          "import 'lib';",
          "import { x } from 'lib/sub.js';",
          "import fs from 'node:fs';",
          "export { y } from './a.ts';",
          "export * from './types';",
          "export type { U } from './types';",
          "import { z } from './missing';",
          "const lazy = import('./lazy.ts');",
          "const required = require('./cjs.cjs');",
          "import out from '../dist/out.js';",
          'export { a };',
        ].join('\n'),
        'src/a.ts': 'export const a = 1, b = 2, y = 3; export default 4;',
        'src/types.ts': 'export type T = string; export type U = number;',
        'src/lazy.ts': '',
        'src/cjs.cjs': '',
      },
      config: { ignore: ['dist/**'] },
    });
    expect(findings.map((finding) => finding.message)).toEqual([
      '1 import reexport ./a.ts -> internal src/a.ts [a,b]',
      '2 import type ./types -> internal src/types.ts [T]',
      '3 import @/a.js -> internal src/a.ts [default,*]',
      '4 import lib -> external lib []',
      '5 import lib/sub.js -> external lib/sub.js [x]',
      '6 import node:fs -> builtin fs [default]',
      '7 export reexport ./a.ts -> internal src/a.ts [y]',
      '8 export reexport ./types -> internal src/types.ts [*]',
      '9 export type reexport ./types -> internal src/types.ts [U]',
      '10 import ./missing -> unresolved  [z]',
      '11 dynamic ./lazy.ts -> internal src/lazy.ts [*]',
      '12 require ./cjs.cjs -> internal src/cjs.cjs [*]',
      '13 import ../dist/out.js -> excluded dist/out.js [default]',
    ]);
  });

  it('falls back to resolution without tsconfig when a tsconfig cannot be read', async () => {
    const findings = await runRule(reportEdges, {
      files: {
        'tsconfig.json': JSON.stringify({ extends: './missing.json' }),
        'src/a.ts': "import { b } from './b.ts';",
        'src/b.ts': 'export const b = 1;',
      },
      paths: ['src/a.ts'],
    });
    expect(findings.map((finding) => finding.message)).toEqual([
      '1 import ./b.ts -> internal src/b.ts [b]',
    ]);
  });

  it('maps workspace packages to their source', async () => {
    const findings = await runRule(reportEdges, {
      paths: ['packages/app'],
      files: {
        'package.json': JSON.stringify({ name: 'root', private: true }),
        'packages/app/package.json': JSON.stringify({ name: 'app' }),
        'packages/app/src/index.ts':
          "import { ui } from '@acme/ui';\nimport { b } from '@acme/ui/button';",
        'packages/ui/package.json': JSON.stringify({ name: '@acme/ui', main: 'dist/index.js' }),
        'packages/ui/src/index.ts': 'export const ui = 1;',
        'packages/ui/src/button.ts': 'export const b = 1;',
      },
    });
    expect(findings.map((finding) => finding.message)).toEqual([
      '1 import @acme/ui -> internal packages/ui/src/index.ts [ui]',
      '2 import @acme/ui/button -> internal packages/ui/src/button.ts [b]',
    ]);
  });
});

const reportExports = defineRule({
  meta: { description: 'Reports exports.', severity: 'warn' },
  create: (context) => ({
    module(file, module: ModuleInfo) {
      context.report({
        at: file,
        message: module.exports
          .map((entry) => `${entry.name}${entry.typeOnly ? ':type' : ''}@${entry.line}`)
          .join(' '),
      });
    },
  }),
});

describe('module info', () => {
  it('lists exports with names, kinds, and lines', async () => {
    const findings = await runRule(reportExports, {
      files: {
        'a.ts': [
          'export const a = 1;',
          'export function b() {}',
          'export type C = string;',
          'export interface D {}',
          'export default class {}',
          'const e = 1;',
          'export { e as f };',
          "export * from './b.ts';",
        ].join('\n'),
        'b.ts': '',
      },
      paths: ['a.ts'],
    });
    expect(findings.map((finding) => finding.message)).toEqual([
      'a@1 b@2 C:type@3 D:type@4 default@5 f@7 *@8',
    ]);
  });
});

describe('config', () => {
  const optioned = defineRule({
    meta: { description: 'Reports files with a configured message.', severity: 'warn' },
    options: v.object({ text: v.string() }),
    describe: (options) => `Says ${options.text}.`,
    create: (context) => ({
      file(file) {
        context.report({ at: file, message: context.options.text });
      },
    }),
  });

  it('rejects invalid options', async () => {
    await expect(
      runRule(optioned, { files: { 'a.ts': '' }, options: { text: 1 } }),
    ).rejects.toThrow(/Rule "test\/rule" has invalid options at text/);
  });

  it('rejects missing required options', async () => {
    await expect(runRule(optioned, { files: { 'a.ts': '' } })).rejects.toThrow(/invalid options/);
  });

  it('applies overrides by path and element, keeping options when only the level changes', async () => {
    const findings = await runRule(optioned, {
      options: { text: 'base' },
      config: {
        elements: [{ type: 'feature', pattern: 'src/features/:name' }],
        overrides: [
          { files: ['src/legacy/**'], rules: { 'test/rule': 'off' } },
          { elements: ['feature'], rules: { 'test/rule': ['error', { text: 'feature' }] } },
          { files: ['src/features/b/**'], rules: { 'test/rule': 'warn' } },
        ],
      },
      files: {
        'src/a.ts': '',
        'src/legacy/old.ts': '',
        'src/features/a/index.ts': '',
        'src/features/b/index.ts': '',
      },
    });
    expect(
      findings.map((finding) => `${finding.location.path} ${finding.severity} ${finding.message}`),
    ).toEqual([
      'src/a.ts warn base',
      'src/features/a/index.ts error feature',
      'src/features/b/index.ts warn feature',
    ]);
  });

  it('rejects overrides that reference unknown element types', async () => {
    await expect(
      runRule(optioned, {
        options: { text: 'x' },
        files: { 'a.ts': '' },
        config: { overrides: [{ elements: ['nope'], rules: {} }] },
      }),
    ).rejects.toThrow(/element type "nope", which is not defined/);
  });

  it('adds elements from extends after the config elements, the last fragment first', async () => {
    const plugin = definePlugin({ name: 'files', rules: { report: reportFiles } });
    const findings = await runConfig(
      {
        plugins: [plugin],
        extends: [
          { elements: [{ type: 'package', pattern: 'packages/:name' }] },
          {
            elements: [
              { type: 'slice', pattern: 'packages/:name/src/:layer/:slice', entry: '@x/*.ts' },
            ],
          },
        ],
        elements: [{ type: 'own', pattern: 'packages/tools' }],
        rules: { 'files/report': 'warn' },
      },
      {
        files: {
          'packages/tools/a.ts': '',
          'packages/web/a.ts': '',
          'packages/web/src/entities/song/@x/artist.ts': '',
          'packages/web/src/entities/song/index.ts': '',
        },
      },
    );
    expect(
      findings
        .filter((finding) => finding.ruleId === 'files/report')
        .map((finding) => finding.message.split(' ').at(-1)),
    ).toEqual([
      'own:packages/tools:a.ts:false',
      'package:packages/web:a.ts:false',
      'slice:packages/web/src/entities/song:@x/artist.ts:true',
      'slice:packages/web/src/entities/song:index.ts:false',
    ]);
  });
});

describe('scope', () => {
  const related = defineRule({
    meta: { description: 'Reports a.ts with b.ts as related.', severity: 'warn' },
    create: (context) => ({
      project() {
        context.report({ at: { path: 'src/a.ts' }, message: 'a', related: [{ path: 'src/b.ts' }] });
        context.report({ at: { path: 'src/c.ts' }, message: 'c' });
        context.report({ at: 'project', message: 'project' });
      },
    }),
  });

  it('shows findings whose location or related locations are in scope', async () => {
    const findings = await runRule(related, {
      paths: ['src/b.ts'],
      files: { 'src/a.ts': '', 'src/b.ts': '', 'src/c.ts': '' },
    });
    expect(findings.map((finding) => finding.message)).toEqual(['project', 'a']);
  });

  it('limits to changed files with --changed', async () => {
    const findings = await runRule(reportFiles, {
      changed: true,
      base: { 'a.ts': '', 'b.ts': '' },
      files: { 'a.ts': 'changed', 'b.ts': '', 'c.ts': '' },
    });
    expect(findings.map((finding) => finding.location.path)).toEqual(['a.ts', 'c.ts']);
  });
});

describe('--new', () => {
  const longFiles = defineRule({
    meta: { description: 'Reports files with more than one line.', severity: 'warn' },
    create: (context) => ({
      text(file, text) {
        if (text.includes('\n')) {
          context.report({ at: { path: file.path, line: 2 }, message: 'Too long.' });
        }
      },
    }),
  });

  it('hides findings that already exist at the base ref', async () => {
    const findings = await runRule(longFiles, {
      onlyNew: true,
      base: { 'old.ts': 'a\nb', 'gone.ts': 'a\nb', 'fixed.ts': 'a\nb' },
      files: { 'old.ts': 'x\na\nb', 'fixed.ts': 'a', 'new.ts': 'a\nb' },
    });
    expect(findings.map((finding) => finding.location.path)).toEqual(['new.ts']);
  });
});

describe('changes', () => {
  const changed = defineRule({
    meta: { description: 'Reports changed files.', severity: 'warn' },
    create: (context) => ({
      project() {
        for (const change of context.changes.files) {
          context.report({ at: { path: change.path }, message: change.status });
        }
      },
    }),
  });

  it('lists changes against the base ref, including untracked and deleted files', async () => {
    const findings = await runRule(changed, {
      base: { 'a.ts': '1', 'b.ts': '1' },
      files: { 'a.ts': '2', 'c.ts': '1' },
    });
    expect(findings.map((finding) => `${finding.location.path} ${finding.message}`)).toEqual([
      'a.ts modified',
      'b.ts deleted',
      'c.ts added',
    ]);
  });

  it('reports pilotlint/no-git when a rule needs git outside a repository', async () => {
    const findings = await runRule(changed, { files: { 'a.ts': '' } });
    expect(findings).toEqual([]);
  });
});
