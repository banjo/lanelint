import { AstUtil, defineRule, type AstNode } from '@lanelint/core';
import { toStandardJsonSchema } from '@valibot/to-json-schema';
import * as v from 'valibot';
import { HintSchema, ReasonSchema, SelectorListSchema } from '../models/optionSchemas.ts';
import { SelectorUtil } from '../utils/selectorUtil.ts';

/** Objects whose properties are globals, as in `globalThis.fetch`. */
const GLOBAL_OBJECTS = new Set(['globalThis', 'window', 'self', 'global']);

/** Subtrees that only describe types and never run. */
const TYPE_ONLY = new Set([
  'TSTypeAnnotation',
  'TSTypeAliasDeclaration',
  'TSInterfaceDeclaration',
  'TSTypeParameterInstantiation',
  'TSTypeParameterDeclaration',
  'TSTypeQuery',
  'TSDeclareFunction',
  'TSModuleDeclaration',
]);

const RestrictionSchema = v.object({
  name: v.pipe(
    v.string(),
    v.regex(/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?$/, 'Use a name such as fetch or Date.now.'),
    v.description('A global such as `fetch` or `process`, or a member such as `Date.now`.'),
  ),
  from: v.optional(
    v.pipe(
      SelectorListSchema,
      v.description('Files the restriction applies to. Defaults to every file.'),
    ),
  ),
  message: v.optional(ReasonSchema),
  hint: v.optional(HintSchema),
});

/** Whether an identifier is read as a value, rather than used as a property name or label. */
const isReference = (parent: AstNode | undefined, key: string | undefined) => {
  if (!parent) {
    return true;
  }
  switch (parent.type) {
    case 'MemberExpression':
      return key !== 'property' || parent.computed;
    case 'Property':
    case 'MethodDefinition':
    case 'PropertyDefinition':
    case 'AccessorProperty':
      return key !== 'key' || parent.computed;
    case 'LabeledStatement':
    case 'BreakStatement':
    case 'ContinueStatement':
      return false;
    case 'ImportSpecifier':
    case 'ExportSpecifier':
      return false;
    default:
      return true;
  }
};

export const restrictedGlobals = defineRule({
  meta: {
    description: 'Globals, or members of globals, that must not be used.',
    severity: 'error',
    docs: [
      'Import rules cannot see globals such as `fetch`, `process`, `Date.now`, or `Math.random`.',
      'This rule finds them in the code, including `globalThis.fetch`. A name declared in the',
      'file, for example a parameter called `fetch`, is not the global and is not reported.',
      'Restrictions can apply to some elements or files only, for example to keep utils pure.',
      '',
      'To fix a finding, pass the value in, or move the code to a place where it is allowed.',
    ].join('\n'),
    example: [
      'error',
      {
        globals: [
          { name: 'fetch', from: { files: '**/utils/**' }, message: 'Utils are pure functions.' },
          { name: 'Date.now', from: { files: '**/utils/**' }, hint: 'Pass the time in.' },
        ],
      },
    ],
  },
  options: toStandardJsonSchema(
    v.object({
      globals: v.pipe(v.array(RestrictionSchema), v.description('The restricted globals.')),
    }),
  ),
  describe: (options) =>
    options.globals.map((restriction) => {
      const where = restriction.from ? ` in ${SelectorUtil.describe(restriction.from)}` : '';
      return `Do not use ${restriction.name}${where}.${restriction.message ? ` ${restriction.message}` : ''}`;
    }),
  elementTypes: (options) =>
    options.globals.flatMap((restriction) => SelectorUtil.typesOf(restriction.from)),
  create: (context) => ({
    ast(file, ast) {
      // Cheap text checks first, so files that cannot match never build the program.
      const restrictions = context.options.globals.filter(
        (restriction) =>
          (!restriction.from || SelectorUtil.matches(restriction.from, file)) &&
          ast.text.includes(restriction.name.split('.').at(-1) ?? restriction.name),
      );
      if (!restrictions.length) {
        return;
      }
      const byName = new Map(restrictions.map((restriction) => [restriction.name, restriction]));
      const declared = AstUtil.declaredNames(ast.program);
      const seen = new Map<string, number>();
      const report = (name: string, start: number) => {
        const restriction = byName.get(name);
        if (!restriction || declared.has(name.split('.')[0] ?? name)) {
          return;
        }
        // Count occurrences instead of using lines, so the identity survives edits above.
        const occurrence = (seen.get(name) ?? 0) + 1;
        seen.set(name, occurrence);
        context.report({
          at: { path: file.path, line: ast.lineOf(start) },
          message: `Do not use ${name}.${restriction.message ? ` ${restriction.message}` : ''}`,
          hint: restriction.hint,
          key: `${name}#${occurrence}`,
        });
      };
      AstUtil.walk(ast.program, (node, parent, key) => {
        if (TYPE_ONLY.has(node.type)) {
          return false;
        }
        if (node.type === 'Identifier' && isReference(parent, key)) {
          report(node.name, node.start);
        }
        if (
          node.type === 'MemberExpression' &&
          !node.computed &&
          node.object.type === 'Identifier' &&
          node.property.type === 'Identifier'
        ) {
          const object = node.object.name;
          const property = node.property.name;
          report(GLOBAL_OBJECTS.has(object) ? property : `${object}.${property}`, node.start);
        }
        return undefined;
      });
    },
  }),
});
