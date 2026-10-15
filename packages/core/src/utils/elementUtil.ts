import type { ElementDefinition } from '../models/config.ts';
import { DEFAULT_ENTRIES } from '../constants/defaults.ts';
import { ConfigError } from '../errors.ts';

type Segment =
  | { readonly type: 'literal'; readonly value: string }
  | { readonly type: 'capture'; readonly name: string }
  | { readonly type: 'wildcard' };

export interface CompiledElement {
  readonly definition: ElementDefinition;
  readonly segments: readonly Segment[];
  readonly entries: readonly string[];
}

export interface ElementMatch {
  readonly element: CompiledElement;
  readonly root: string;
  readonly captures: Readonly<Record<string, string>>;
}

const compileOne = (definition: ElementDefinition): CompiledElement => {
  const parts = definition.pattern.replace(/^\.?\/+|\/+$/g, '').split('/');
  if (!definition.pattern.trim() || parts.some((part) => !part)) {
    throw new ConfigError(
      `Element "${definition.type}" has an invalid pattern "${definition.pattern}".`,
    );
  }
  const segments = parts.map((part): Segment => {
    if (part === '*') {
      return { type: 'wildcard' };
    }
    if (part.startsWith(':')) {
      return { type: 'capture', name: part.slice(1) };
    }
    return { type: 'literal', value: part };
  });
  const captures = new Set(
    segments.flatMap((segment) => (segment.type === 'capture' ? [segment.name] : [])),
  );
  for (const name of Object.keys(definition.where ?? {})) {
    if (!captures.has(name)) {
      throw new ConfigError(
        `Element "${definition.type}" restricts ":${name}" in "where", but its pattern has no such capture.`,
      );
    }
  }
  const entry = definition.entry ?? DEFAULT_ENTRIES;
  return { definition, segments, entries: typeof entry === 'string' ? [entry] : [...entry] };
};

const compile = (definitions: readonly ElementDefinition[]): CompiledElement[] =>
  definitions.map(compileOne);

/** The first element whose pattern matches a prefix of the directory. */
const match = (
  elements: readonly CompiledElement[],
  directory: string,
): ElementMatch | undefined => {
  const parts = directory ? directory.split('/') : [];
  for (const element of elements) {
    if (element.segments.length > parts.length) {
      continue;
    }
    const captures: Record<string, string> = {};
    const matched = element.segments.every((segment, index) => {
      const part = parts[index] ?? '';
      if (segment.type === 'literal') {
        return segment.value === part;
      }
      if (segment.type === 'capture') {
        const allowed = element.definition.where?.[segment.name];
        if (allowed && !allowed.includes(part)) {
          return false;
        }
        captures[segment.name] = part;
      }
      return true;
    });
    if (matched) {
      return { element, root: parts.slice(0, element.segments.length).join('/'), captures };
    }
  }
  return undefined;
};

export const ElementUtil = {
  compile,
  match,
};
