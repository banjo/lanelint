import { describe, expect, it } from 'vite-plus/test';
import { testRule } from '@lanelint/core/testing';
import { noManualEdit, requiresChange } from '../src/index.ts';

const framework = { describe, it, expect };

const requires = {
  rules: [
    {
      when: 'src/**/messages.ts',
      require: 'src/translations/en.json',
      hint: 'Run pnpm extract-intl.',
    },
  ],
};

testRule(
  'changes/requires-change',
  requiresChange,
  {
    valid: [
      {
        name: 'both changed',
        options: requires,
        base: { 'src/a/messages.ts': '1', 'src/translations/en.json': '{}' },
        files: { 'src/a/messages.ts': '2', 'src/translations/en.json': '{"a":1}' },
      },
      {
        name: 'unrelated change',
        options: requires,
        base: { 'src/a/other.ts': '1' },
        files: { 'src/a/other.ts': '2' },
      },
    ],
    invalid: [
      {
        options: requires,
        base: {
          'src/a/messages.ts': '1',
          'src/b/messages.ts': '1',
          'src/translations/en.json': '{}',
        },
        files: {
          'src/a/messages.ts': '2',
          'src/b/messages.ts': '2',
          'src/translations/en.json': '{}',
        },
        findings: [
          {
            path: 'src/a/messages.ts',
            message:
              'src/a/messages.ts, src/b/messages.ts changed, but nothing matching src/translations/en.json did.',
            hint: 'Run pnpm extract-intl.',
          },
        ],
      },
      {
        name: 'always new, since nothing changed at the base ref',
        options: requires,
        onlyNew: true,
        base: { 'src/a/messages.ts': '1', 'src/translations/en.json': '{}' },
        files: { 'src/a/messages.ts': '2', 'src/translations/en.json': '{}' },
        findings: [{ path: 'src/a/messages.ts' }],
      },
    ],
  },
  framework,
);

testRule(
  'changes/no-manual-edit',
  noManualEdit,
  {
    valid: [
      {
        name: 'regenerated together with its input',
        options: { rules: [{ files: 'src/generated/**', unless: 'schemas/**' }] },
        base: { 'src/generated/api.ts': '1', 'schemas/api.json': '1' },
        files: { 'src/generated/api.ts': '2', 'schemas/api.json': '2' },
      },
    ],
    invalid: [
      {
        options: {
          rules: [{ files: 'src/generated/**', unless: 'schemas/**', hint: 'Run pnpm generate.' }],
        },
        base: { 'src/generated/api.ts': '1', 'schemas/api.json': '1' },
        files: { 'src/generated/api.ts': '2', 'schemas/api.json': '1' },
        findings: [
          {
            path: 'src/generated/api.ts',
            message: 'src/generated/api.ts is generated and must not be edited by hand.',
            hint: 'Run pnpm generate.',
          },
        ],
      },
    ],
  },
  framework,
);
