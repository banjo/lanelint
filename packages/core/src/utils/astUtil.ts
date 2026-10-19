import type { Node } from 'oxc-parser';
// Only the keys, so walking an AST does not load the parser and its native binding.
import visitorKeys from 'oxc-parser/src-js/generated/visit/keys';

/** Return `false` to skip the children of a node. */
export type AstVisitor = (
  node: Node,
  parent: Node | undefined,
  key: string | undefined,
) => void | false;

const isNode = (value: unknown): value is Node =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { type?: unknown }).type === 'string';

/** Visits every node depth-first, with its parent and the parent property that holds it. */
const walk = (root: Node, visitor: AstVisitor): void => {
  const visit = (node: Node, parent: Node | undefined, key: string | undefined) => {
    if (visitor(node, parent, key) === false) {
      return;
    }
    for (const childKey of visitorKeys[node.type] ?? []) {
      const value = (node as unknown as Record<string, unknown>)[childKey];
      if (Array.isArray(value)) {
        for (const child of value) {
          if (isNode(child)) {
            visit(child, node, childKey);
          }
        }
      } else if (isNode(value)) {
        visit(value, node, childKey);
      }
    }
  };
  visit(root, undefined, undefined);
};

/** Names bound by a declaration pattern, such as `{ a, b: [c], ...d } = value`. */
const bindingNames = (pattern: Node | null | undefined): string[] => {
  if (!pattern) {
    return [];
  }
  switch (pattern.type) {
    case 'Identifier':
      return [pattern.name];
    case 'ObjectPattern':
      return pattern.properties.flatMap((property) =>
        property.type === 'RestElement'
          ? bindingNames(property.argument)
          : bindingNames(property.value),
      );
    case 'ArrayPattern':
      return pattern.elements.flatMap((element) => bindingNames(element));
    case 'AssignmentPattern':
      return bindingNames(pattern.left);
    case 'RestElement':
      return bindingNames(pattern.argument);
    case 'TSParameterProperty':
      return bindingNames(pattern.parameter);
    default:
      return [];
  }
};

/** Every name declared anywhere in a program: variables, functions, classes, parameters, and imports. */
const declaredNames = (program: Node): Set<string> => {
  const names = new Set<string>();
  const add = (list: readonly string[]) => list.forEach((name) => names.add(name));
  walk(program, (node) => {
    switch (node.type) {
      case 'VariableDeclarator':
        add(bindingNames(node.id));
        break;
      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        if ('id' in node && node.id) {
          add([node.id.name]);
        }
        add(node.params.flatMap((parameter) => bindingNames(parameter)));
        break;
      case 'ClassDeclaration':
      case 'ClassExpression':
        if (node.id) {
          add([node.id.name]);
        }
        break;
      case 'CatchClause':
        add(bindingNames(node.param));
        break;
      case 'ImportSpecifier':
      case 'ImportDefaultSpecifier':
      case 'ImportNamespaceSpecifier':
        add([node.local.name]);
        break;
      default:
        break;
    }
  });
  return names;
};

export const AstUtil = {
  bindingNames,
  declaredNames,
  walk,
};
