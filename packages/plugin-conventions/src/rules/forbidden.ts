import { defineRule, GlobUtil } from '@pilotlint/core';
import { toStandardJsonSchema } from '@valibot/to-json-schema';
import * as v from 'valibot';
import { NamePatternSchema } from '../models/optionSchemas.ts';

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
