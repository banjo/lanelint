import { GlobUtil, type ElementInfo, type ProjectFile } from '@pilotlint/core';
import type { Selector } from '../models/optionSchemas.ts';

interface Target {
  readonly path: string;
  readonly element: ElementInfo | undefined;
}

const matchesOne = (selector: Selector, target: Target): boolean => {
  if (typeof selector === 'string') {
    return target.element?.type === selector;
  }
  if (selector.type !== undefined && target.element?.type !== selector.type) {
    return false;
  }
  for (const [name, allowed] of Object.entries(selector.captures ?? {})) {
    const value = target.element?.captures[name];
    if (
      value === undefined ||
      !(typeof allowed === 'string' ? [allowed] : allowed).includes(value)
    ) {
      return false;
    }
  }
  return !selector.files || GlobUtil.matches(target.path, selector.files);
};

const matches = (selectors: readonly Selector[], target: Target | ProjectFile): boolean =>
  selectors.some((selector) => matchesOne(selector, target));

const describeOne = (selector: Selector): string => {
  if (typeof selector === 'string') {
    return selector;
  }
  const captures = Object.entries(selector.captures ?? {}).map(
    ([name, value]) => `${name}=${typeof value === 'string' ? value : value.join('|')}`,
  );
  const files = selector.files ? `files ${GlobUtil.toList(selector.files).join(', ')}` : '';
  return [selector.type ?? '', captures.length ? `(${captures.join(', ')})` : '', files]
    .filter(Boolean)
    .join(' ');
};

const describe = (selectors: readonly Selector[]): string => {
  const names = selectors.map(describeOne);
  return names.length > 1
    ? `${names.slice(0, -1).join(', ')} or ${names.at(-1)}`
    : (names[0] ?? '');
};

/** Element types referenced by selectors, for config validation. */
const typesOf = (selectors: readonly Selector[] | undefined): string[] =>
  (selectors ?? []).flatMap((selector) =>
    typeof selector === 'string' ? [selector] : selector.type ? [selector.type] : [],
  );

/** True for selectors that match files by glob only, not elements. */
const isFilesOnly = (selector: Selector): boolean =>
  typeof selector !== 'string' &&
  !!selector.files &&
  selector.type === undefined &&
  selector.captures === undefined;

export const SelectorUtil = {
  describe,
  isFilesOnly,
  matches,
  typesOf,
};
