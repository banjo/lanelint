import type { ResolvedConfig, ResolvedEntry } from '../config/resolveConfig.ts';
import { LocationUtil } from '../engine/location.ts';
import type { Severity } from '../models/finding.ts';
import type { ElementInfo } from '../models/project.ts';
import { ParseUtil } from '../project/parse.ts';
import { createProject } from '../project/project.ts';
import { ResolveUtil } from '../project/resolve.ts';
import { SnapshotUtil } from '../project/snapshot.ts';
import { CORE_PLUGIN_NAME } from '../rules/corePlugin.ts';

export interface ElementDescription {
  readonly type: string;
  readonly pattern: string;
  readonly description: string | undefined;
  readonly entries: readonly string[];
  /** Roots of the elements that currently match. */
  readonly matches: readonly string[];
}

export interface RuleDescription {
  readonly id: string;
  readonly level: Severity;
  readonly sentences: readonly string[];
}

export interface RuleGroupDescription {
  /** The override description, or a summary of where it applies. */
  readonly title: string;
  readonly files: readonly string[] | undefined;
  readonly ignore: readonly string[] | undefined;
  readonly elements: readonly string[] | undefined;
  readonly rules: readonly RuleDescription[];
}

export interface PathDescription {
  readonly path: string;
  readonly exists: boolean;
  readonly element: ElementInfo | undefined;
  readonly rules: readonly RuleDescription[];
}

export interface ProjectDescription {
  readonly elements: readonly ElementDescription[];
  /** Rules that apply everywhere, then one group per override. */
  readonly groups: readonly RuleGroupDescription[];
  /** Set when describing a single path. */
  readonly path: PathDescription | undefined;
}

const describeRule = (
  config: ResolvedConfig,
  id: string,
  entry: ResolvedEntry,
): RuleDescription | undefined => {
  const rule = config.rules.get(id);
  if (!rule || entry.level === 'off' || id.startsWith(`${CORE_PLUGIN_NAME}/`)) {
    return undefined;
  }
  const options = config.optionsOf(id, entry.optionsKey);
  const described = rule.describe?.(options) ?? rule.meta.description;
  return {
    id,
    level: entry.level,
    sentences: typeof described === 'string' ? [described] : [...described],
  };
};

const describeEntries = (config: ResolvedConfig, entries: ReadonlyMap<string, ResolvedEntry>) =>
  [...entries]
    .map(([id, entry]) => describeRule(config, id, entry))
    .filter((rule): rule is RuleDescription => !!rule)
    .sort((a, b) => a.id.localeCompare(b.id));

const where = (files?: readonly string[], elements?: readonly string[]) =>
  [
    elements?.length ? `elements ${elements.join(', ')}` : '',
    files?.length ? `files ${files.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('; ');

/** Describes the configured structure, or what applies to one path. */
export async function describeProject(
  config: ResolvedConfig,
  options: { readonly path?: string } = {},
): Promise<ProjectDescription> {
  const snapshot = await SnapshotUtil.createWorkingTree(config.root, {
    include: config.include,
    ignore: config.ignore,
  });
  const project = createProject({
    snapshot,
    filter: { include: config.include, ignore: config.ignore },
    elements: config.elements,
    tests: config.tests,
    configFile: config.configFile,
    parseCache: ParseUtil.createCache(),
    resolver: ResolveUtil.create(),
  });

  const elements = config.elements.map((compiled) => ({
    type: compiled.definition.type,
    pattern: compiled.definition.pattern,
    description: compiled.definition.description,
    entries: compiled.entries,
    matches: project.elements
      .filter((element) => element.type === compiled.definition.type)
      .map((element) => element.root),
  }));

  const groups: RuleGroupDescription[] = [
    {
      title: 'Everywhere',
      files: undefined,
      ignore: undefined,
      elements: undefined,
      rules: describeEntries(config, config.base),
    },
  ];
  for (const override of config.overrides) {
    const entries = new Map<string, ResolvedEntry>();
    for (const [id, entry] of override.rules) {
      const previous = config.base.get(id);
      const input = entry.hasInput ? entry.input : previous?.input;
      const hasInput = entry.hasInput || (previous?.hasInput ?? false);
      entries.set(id, {
        level: entry.level,
        input,
        hasInput,
        optionsKey: hasInput ? JSON.stringify(input) : '',
      });
    }
    groups.push({
      title: override.description ?? `Override for ${where(override.files, override.elements)}`,
      files: override.files,
      ignore: override.ignore,
      elements: override.elements,
      rules: describeEntries(config, entries),
    });
  }

  let path: PathDescription | undefined;
  if (options.path !== undefined) {
    const location = LocationUtil.toLocation({ path: options.path }, project);
    path = {
      path: location.path,
      exists: location.kind !== 'path',
      element:
        project.file(location.path)?.element ??
        project.directory(location.path)?.element ??
        project.elementAt(location.path),
      rules: describeEntries(
        config,
        config.entriesAt(LocationUtil.toConfigLocation(location, project)),
      ),
    };
  }
  return { elements, groups: groups.filter((group) => group.rules.length), path };
}
