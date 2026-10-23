import { defineRule, GlobUtil, type ProjectApi } from '@lanelint/core';
import { normalize } from 'node:path/posix';
import { toStandardJsonSchema } from '@valibot/to-json-schema';
import * as v from 'valibot';
import { HintSchema, MessageSchema } from '../models/optionSchemas.ts';

const isGlob = (path: string) => /[*?{}[\]]/.test(path);

/** Whether a file matching a path or glob exists, relative to a directory. */
const existsIn = (project: ProjectApi, directory: string, path: string) => {
  const target = directory ? `${directory}/${path}` : path;
  return isGlob(path)
    ? project.files.some(
        (file) => file.path.startsWith(`${directory}/`) && GlobUtil.matches(file.path, target),
      )
    : project.exists(target);
};

export const requiredFiles = defineRule({
  meta: {
    description: 'Files that must exist in each element or matching directory.',
    severity: 'error',
    docs: [
      'Each entry names where (`in`: an element type, or `{ directories: glob }`) and which',
      'file must exist there (`path`, relative, may be a glob such as `index.{ts,tsx}`).',
      '',
      'To fix a finding, create the file.',
    ].join('\n'),
    example: [
      'error',
      {
        files: [
          { in: 'feature', path: 'index.{ts,tsx}' },
          { in: { directories: 'src/**/components/*' }, path: '*.stories.tsx' },
        ],
      },
    ],
  },
  options: toStandardJsonSchema(
    v.object({
      files: v.pipe(
        v.array(
          v.object({
            in: v.pipe(
              v.union([
                v.string(),
                v.object({
                  directories: v.pipe(v.string(), v.description('Glob of directory paths.')),
                }),
              ]),
              v.description('An element type, or `{ directories }` for matching directories.'),
            ),
            path: v.pipe(
              v.string(),
              v.description(
                'File that must exist, relative to the element or directory. May be a glob.',
              ),
            ),
            message: v.optional(MessageSchema),
            hint: v.optional(HintSchema),
          }),
        ),
        v.description('Required files.'),
      ),
    }),
  ),
  describe: (options) =>
    options.files.map(
      (entry) =>
        `Each ${typeof entry.in === 'string' ? `${entry.in} element` : `directory matching ${entry.in.directories}`} has ${entry.path}.`,
    ),
  elementTypes: (options) =>
    options.files.flatMap((entry) => (typeof entry.in === 'string' ? [entry.in] : [])),
  create: (context) => ({
    element(element) {
      for (const entry of context.options.files) {
        if (entry.in === element.type && !existsIn(context.project, element.root, entry.path)) {
          context.report({
            at: element,
            message: entry.message ?? `${element.root} has no ${entry.path}.`,
            hint: entry.hint ?? `Create ${element.root}/${entry.path}.`,
            key: entry.path,
          });
        }
      }
    },
    directory(directory) {
      for (const entry of context.options.files) {
        if (
          typeof entry.in !== 'string' &&
          GlobUtil.matches(directory.path, entry.in.directories) &&
          !existsIn(context.project, directory.path, entry.path)
        ) {
          context.report({
            at: directory,
            message: entry.message ?? `${directory.path} has no ${entry.path}.`,
            hint: entry.hint ?? `Create ${directory.path}/${entry.path}.`,
            key: entry.path,
          });
        }
      }
    },
  }),
});

export const companionFiles = defineRule({
  meta: {
    description: 'Some files require a companion file, such as a test next to a component.',
    severity: 'error',
    docs: [
      '`requires` is a path relative to the file, where `{stem}` is the file name before the',
      'first dot and `{name}` is the full name. It may be a glob, for example',
      '`{stem}.{test,spec}.tsx`. Test files are never required to have companions.',
      '',
      'To fix a finding, create the companion file.',
    ].join('\n'),
    example: [
      'error',
      { rules: [{ files: 'src/**/components/*.tsx', requires: '{stem}.test.tsx' }] },
    ],
  },
  options: toStandardJsonSchema(
    v.object({
      rules: v.pipe(
        v.array(
          v.object({
            files: v.pipe(
              v.union([v.string(), v.array(v.string())]),
              v.description('Globs of files that need a companion.'),
            ),
            requires: v.pipe(
              v.string(),
              v.description(
                'Path of the companion, relative to the file, with `{stem}` and `{name}`.',
              ),
            ),
            message: v.optional(MessageSchema),
            hint: v.optional(HintSchema),
          }),
        ),
        v.description('Companion rules.'),
      ),
    }),
  ),
  describe: (options) =>
    options.rules.map(
      (rule) =>
        `Files matching ${GlobUtil.toList(rule.files).join(', ')} have a ${rule.requires} next to them.`,
    ),
  create: (context) => ({
    file(file) {
      if (file.isTest) {
        return;
      }
      for (const rule of context.options.rules) {
        if (!GlobUtil.matches(file.path, rule.files)) {
          continue;
        }
        const required = rule.requires
          .replaceAll('{stem}', file.stem)
          .replaceAll('{name}', file.name);
        if (existsIn(context.project, file.directory, required)) {
          continue;
        }
        const path = normalize(file.directory ? `${file.directory}/${required}` : required);
        context.report({
          at: { path },
          message: rule.message ?? `${file.path} needs ${path}.`,
          hint: rule.hint ?? `Create ${path}.`,
          related: [file],
        });
      }
    },
  }),
});
