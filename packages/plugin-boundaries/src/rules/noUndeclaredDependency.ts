import { defineRule, GlobUtil, type PackageInfo } from '@lanelint/core';
import { toStandardJsonSchema } from '@valibot/to-json-schema';
import * as v from 'valibot';
import { EdgeUtil } from '../utils/edgeUtil.ts';

const typesPackageOf = (name: string) =>
  `@types/${name.startsWith('@') ? name.slice(1).replace('/', '__') : name}`;

const declares = (info: PackageInfo, name: string, dev: boolean) =>
  name in info.dependencies ||
  name in info.peerDependencies ||
  name in info.optionalDependencies ||
  (dev && name in info.devDependencies);

export const noUndeclaredDependency = defineRule({
  meta: {
    description: 'Imported packages must be declared in the nearest package.json.',
    severity: 'error',
    docs: [
      'A package that is imported but not declared works only by accident, through hoisting or',
      'another package. Imports of workspace packages must be declared too.',
      '',
      'devDependencies count for test files and for files matching `allowDev`. These files may',
      'also use packages declared in the root package.json, where monorepos often keep shared',
      'dev tools such as a test runner. Type-only imports also accept the matching `@types`',
      'package.',
      '',
      'To fix a finding, add the package to the nearest package.json.',
    ].join('\n'),
    example: ['error', { allowDev: ['**/*.config.*', 'scripts/**'], ignore: ['virtual:*'] }],
  },
  options: toStandardJsonSchema(
    v.optional(
      v.object({
        allowDev: v.optional(
          v.pipe(
            v.array(v.string()),
            v.description('Globs of files that may import devDependencies, besides test files.'),
          ),
          ['**/*.config.*', '**/scripts/**'],
        ),
        ignore: v.optional(
          v.pipe(
            v.array(v.string()),
            v.description('Package names or globs that are never reported.'),
          ),
          [],
        ),
        allowRootDev: v.optional(
          v.pipe(
            v.boolean(),
            v.description(
              'Let the files that may use devDependencies also use packages declared in the root package.json.',
            ),
          ),
          true,
        ),
      }),
      {},
    ),
  ),
  create: (context) => ({
    import(edge) {
      const { target } = edge;
      if (target.type === 'builtin' || target.type === 'excluded') {
        return;
      }
      const name =
        target.type === 'external' ? target.package : EdgeUtil.packageNameOf(edge.specifier);
      if (!name || GlobUtil.matches(name, context.options.ignore)) {
        return;
      }
      const info = context.project.packageOf(edge.from);
      if (!info || info.name === name) {
        return;
      }
      if (target.type === 'internal') {
        // A bare import of an internal file is either a workspace package or a path alias.
        const workspace = context.project.workspacePackage(name);
        if (!workspace || context.project.packageOf(target.file)?.directory === info.directory) {
          return;
        }
      }
      const dev = edge.from.isTest || GlobUtil.matches(edge.from.path, context.options.allowDev);
      const root =
        dev && context.options.allowRootDev && info.directory
          ? context.project.packageOf('package.json')
          : undefined;
      const declared = (manifest: PackageInfo) =>
        declares(manifest, name, dev) ||
        (edge.typeOnly && declares(manifest, typesPackageOf(name), true));
      if (declared(info) || (root?.directory === '' && declared(root))) {
        return;
      }
      const manifest = info.directory ? `${info.directory}/package.json` : 'package.json';
      context.report({
        at: edge,
        message: `${name} is not declared in ${manifest}.`,
        hint: `Add ${name} to ${dev ? 'dependencies or devDependencies' : 'dependencies'} in ${manifest}.`,
        key: name,
      });
    },
  }),
});
