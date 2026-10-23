import { defineRule, GlobUtil } from '@lanelint/core';
import { toStandardJsonSchema } from '@valibot/to-json-schema';
import * as v from 'valibot';
import { IncludeTestsSchema } from '../models/optionSchemas.ts';
import { EdgeUtil } from '../utils/edgeUtil.ts';
import { ExportsUtil } from '../utils/exportsUtil.ts';

const MAX_SUBPATHS = 5;

/** The same package, or one package inside the other. The root package contains nothing. */
const nested = (a: string, b: string): boolean =>
  a === b || (!!a && !!b && (a.startsWith(`${b}/`) || b.startsWith(`${a}/`)));

export const workspaceImports = defineRule({
  meta: {
    description:
      'Imports of other workspace packages must use the package name and a subpath it exports.',
    severity: 'error',
    docs: [
      'A workspace package exposes its public API through its name and the `exports` field of',
      'its package.json. Code in another package must not reach past it, with a relative path',
      'into the package or with a subpath that `exports` does not list. A package without',
      '`exports` exports every subpath, as in Node. A package inside another package may also be',
      'imported through the outer package. Imports inside one package, between a package and the',
      'packages nested in it, and of the root package are not checked.',
      '',
      'To fix a finding, import the package by its name and an exported subpath, or add the',
      'subpath to `exports` in the package.json of the imported package.',
      'Test files are skipped unless `includeTests` is set.',
    ].join('\n'),
    example: ['error', { ignore: ['@acme/legacy-*'] }],
  },
  options: toStandardJsonSchema(
    v.optional(
      v.object({
        ignore: v.optional(
          v.pipe(
            v.array(v.string()),
            v.description('Names or globs of packages whose imports are never reported.'),
          ),
          [],
        ),
        includeTests: IncludeTestsSchema,
      }),
      {},
    ),
  ),
  describe: () => 'Other workspace packages are imported by name, through a subpath they export.',
  create: (context) => ({
    import(edge) {
      const to = EdgeUtil.internalTarget(edge);
      if (!to || EdgeUtil.skip(edge, context.options)) {
        return;
      }
      const target = context.project.packageOf(to);
      if (!target?.name || !target.directory) {
        return;
      }
      const from = context.project.packageOf(edge.from)?.directory ?? '';
      if (nested(from, target.directory) || GlobUtil.matches(target.name, context.options.ignore)) {
        return;
      }
      const name = target.name;
      const manifest = `${target.directory}/package.json`;
      // A package can be imported through the name of a package that contains it.
      const via = context.project.workspacePackage(EdgeUtil.packageNameOf(edge.specifier) ?? '');
      if (!via?.name || !to.path.startsWith(`${via.directory}/`)) {
        context.report({
          at: edge,
          message: `Import ${name} by its package name, not by the path ${edge.specifier}.`,
          hint: `Import from "${name}", or a subpath that ${manifest} exports.`,
        });
        return;
      }
      const subpath = `.${edge.specifier.slice(via.name.length)}`;
      if (ExportsUtil.isExported(via.exports, subpath)) {
        return;
      }
      const exported = ExportsUtil.subpathsOf(via.exports);
      const shown = exported.slice(0, MAX_SUBPATHS).join(', ');
      const viaManifest = `${via.directory}/package.json`;
      context.report({
        at: edge,
        message: `${via.name} does not export ${subpath}.`,
        hint: exported.length
          ? `Import from a subpath that ${viaManifest} exports (${shown}${exported.length > MAX_SUBPATHS ? ', …' : ''}), or add ${subpath} to its exports.`
          : `Add ${subpath} to exports in ${viaManifest}.`,
      });
    },
  }),
});
