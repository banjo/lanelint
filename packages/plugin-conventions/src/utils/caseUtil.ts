import type { Case } from '../models/optionSchemas.ts';

const PATTERNS: Record<Case, RegExp> = {
  kebab: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  camel: /^[a-z][a-zA-Z0-9]*$/,
  pascal: /^[A-Z][a-zA-Z0-9]*$/,
  snake: /^[a-z0-9]+(?:_[a-z0-9]+)*$/,
};

const EXAMPLES: Record<Case, string> = {
  kebab: 'kebab-case',
  camel: 'camelCase',
  pascal: 'PascalCase',
  snake: 'snake_case',
};

const words = (name: string) =>
  name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase());

const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

const convert = (name: string, target: Case): string => {
  const parts = words(name);
  switch (target) {
    case 'kebab':
      return parts.join('-');
    case 'snake':
      return parts.join('_');
    case 'camel':
      return parts.map((word, index) => (index ? capitalize(word) : word)).join('');
    case 'pascal':
      return parts.map(capitalize).join('');
  }
};

const matches = (name: string, cases: readonly Case[]) =>
  cases.some((item) => PATTERNS[item].test(name));

const describe = (cases: readonly Case[]) => cases.map((item) => EXAMPLES[item]).join(' or ');

export const CaseUtil = {
  convert,
  describe,
  matches,
};
