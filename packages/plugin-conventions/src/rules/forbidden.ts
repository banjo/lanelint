import { defineRule, GlobUtil } from '@lanelint/core';
import { toStandardJsonSchema } from '@valibot/to-json-schema';
import * as v from 'valibot';
import { HintSchema, MessageSchema, NamePatternSchema } from '../models/optionSchemas.ts';

const describePatterns = (kind: string, patterns: readonly { name: string; message?: string }[]) =>
  patterns.map(
    (pattern) => `No ${kind} named ${pattern.name}.${pattern.message ? ` ${pattern.message}` : ''}`,
  );

export const forbiddenFiles = defineRule({
  meta: {
    description: 'Files with these names must not exist.',
    severity: 'error',
    docs: [
      'Each pattern matches the file name, or the path when it contains `/`. Give each pattern',
      'a message that says what to do instead, for example where the code belongs.',
    ].join('\n'),
    example: [
      'error',
      { patterns: [{ name: 'helpers.ts', message: 'Put helpers in utils/ as *Util.ts files.' }] },
    ],
  },
  options: toStandardJsonSchema(
    v.object({
      patterns: v.pipe(v.array(NamePatternSchema), v.description('Forbidden file names.')),
    }),
  ),
  describe: (options) => describePatterns('files', options.patterns),
  create: (context) => ({
    file(file) {
      const pattern = context.options.patterns.find((candidate) =>
        GlobUtil.matchesName(file.path, file.name, candidate.name),
      );
      if (pattern) {
        context.report({
          at: file,
          message: pattern.message ?? `Files named ${pattern.name} are not allowed.`,
          hint: pattern.hint,
        });
      }
    },
  }),
});

export const forbiddenDirectories = defineRule({
  meta: {
    description: 'Directories with these names must not exist.',
    severity: 'error',
    docs: [
      'Each pattern matches the directory name, or the path when it contains `/`. Give each',
      'pattern a message that says what to do instead.',
    ].join('\n'),
    example: [
      'error',
      { patterns: [{ name: 'helpers', message: 'Put helpers in utils/ instead.' }] },
    ],
  },
  options: toStandardJsonSchema(
    v.object({
      patterns: v.pipe(v.array(NamePatternSchema), v.description('Forbidden directory names.')),
    }),
  ),
  describe: (options) => describePatterns('directories', options.patterns),
  create: (context) => ({
    directory(directory) {
      const pattern = context.options.patterns.find((candidate) =>
        GlobUtil.matchesName(directory.path, directory.name, candidate.name),
      );
      if (pattern) {
        context.report({
          at: directory,
          message: pattern.message ?? `Directories named ${pattern.name} are not allowed.`,
          hint: pattern.hint,
        });
      }
    },
  }),
});

export const allowedDirectories = defineRule({
  meta: {
    description: 'Only directories with these names may exist in some directories.',
    severity: 'error',
    docs: [
      'Each rule matches the parent directory by name, or by path when `directory` contains `/`,',
      'and allows only directories whose names match `names` inside it, for example only',
      '`components`, `hooks`, and `utils` in each feature. Deeper directories are not checked.',
      '',
      'To fix a finding, rename the directory to an allowed name, or move its files into an',
      'allowed directory. A singular name is reported with its allowed plural.',
    ].join('\n'),
    example: [
      'error',
      {
        rules: [
          {
            directory: 'src/features/*',
            names: ['components', 'hooks', 'models', 'services', 'utils', '__tests__'],
          },
        ],
      },
    ],
  },
  options: toStandardJsonSchema(
    v.object({
      rules: v.pipe(
        v.array(
          v.object({
            directory: v.pipe(
              v.string(),
              v.description('Name of the parent directory, or a path glob when it contains `/`.'),
            ),
            names: v.pipe(
              v.array(v.string()),
              v.description('Globs of the directory names allowed in the parent directory.'),
            ),
            message: v.optional(MessageSchema),
            hint: v.optional(HintSchema),
          }),
        ),
        v.description('Allowed names, each for a parent directory.'),
      ),
    }),
  ),
  describe: (options) =>
    options.rules.map(
      (rule) => `Directories in ${rule.directory}/ are named ${rule.names.join(', ')}.`,
    ),
  create: (context) => ({
    directory(directory) {
      if (directory.parent === undefined) {
        return;
      }
      const parentName = directory.parent.slice(directory.parent.lastIndexOf('/') + 1);
      const rule = context.options.rules.find(
        (candidate) =>
          GlobUtil.matchesName(directory.parent ?? '', parentName, candidate.directory) &&
          !GlobUtil.matches(directory.name, candidate.names),
      );
      if (!rule) {
        return;
      }
      const plural = `${directory.name}s`;
      context.report({
        at: directory,
        message:
          rule.message ??
          (GlobUtil.matches(plural, rule.names)
            ? `Rename ${directory.name}/ to ${plural}/.`
            : `${directory.name}/ is not allowed in ${parentName}/.`),
        hint: rule.hint ?? `Use one of: ${rule.names.join(', ')}.`,
      });
    },
  }),
});
