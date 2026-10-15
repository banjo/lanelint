import type { ProjectDescription, RuleDescription } from '@archlint/core';

const code = (value: string) => `\`${value}\``;

const ruleLines = (rules: readonly RuleDescription[]) =>
  rules.flatMap((rule) => {
    const [first, ...rest] = rule.sentences;
    return [
      `- **${rule.level}** ${code(rule.id)}: ${first ?? ''}`,
      ...rest.map((sentence) => `  ${sentence}`),
    ];
  });

const MAX_MATCHES = 10;

/** The structure as Markdown, for agents to read before writing code. */
export const formatMarkdown = (description: ProjectDescription): string => {
  const lines: string[] = [];
  if (description.path) {
    const { path, exists, element, rules } = description.path;
    lines.push(`# What applies to ${code(path || '.')}`, '');
    if (!exists) {
      lines.push('This path does not exist yet. These rules apply when it is created.', '');
    }
    if (element) {
      const relative = element.relativePath ? `, at ${code(element.relativePath)}` : '';
      lines.push(
        `Part of the **${element.type}** element ${code(element.root)}${relative}${element.isEntry ? ', which is an entry file' : ''}.`,
        '',
      );
      const definition = description.elements.find((item) => item.type === element.type);
      if (definition?.description) {
        lines.push(definition.description, '');
      }
    } else {
      lines.push('Not part of any element.', '');
    }
    lines.push('## Rules', '', ...(rules.length ? ruleLines(rules) : ['No rules apply here.']));
    return lines.join('\n');
  }

  lines.push('# Architecture', '');
  if (description.elements.length) {
    lines.push('## Elements', '');
    for (const element of description.elements) {
      lines.push(`### ${element.type}`, '');
      lines.push(
        `Pattern ${code(element.pattern)}, entry ${element.entries.map(code).join(' or ')}.`,
      );
      if (element.description) {
        lines.push('', element.description);
      }
      const shown = element.matches.slice(0, MAX_MATCHES).map(code);
      const more = element.matches.length - shown.length;
      lines.push(
        '',
        element.matches.length
          ? `Current: ${shown.join(', ')}${more > 0 ? `, and ${more} more` : ''}.`
          : 'Nothing matches this element yet.',
        '',
      );
    }
  }
  lines.push('## Rules', '');
  for (const group of description.groups) {
    lines.push(`### ${group.title}`, '');
    const scope = [
      group.elements?.length ? `Elements: ${group.elements.join(', ')}.` : '',
      group.files?.length ? `Files: ${group.files.map(code).join(', ')}.` : '',
      group.ignore?.length ? `Except: ${group.ignore.map(code).join(', ')}.` : '',
    ].filter(Boolean);
    if (scope.length) {
      lines.push(scope.join(' '), '');
    }
    lines.push(...ruleLines(group.rules), '');
  }
  return lines.join('\n').trimEnd();
};
