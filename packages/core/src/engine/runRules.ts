import type { ResolvedConfig, RuleInstance } from '../config/resolveConfig.ts';
import type { ChangeSet } from '../models/changes.ts';
import type { Finding, Location } from '../models/finding.ts';
import type { ProjectFile } from '../models/project.ts';
import type { RuleContext, Visitors } from '../models/rule.ts';
import type { ProjectModel } from '../project/project.ts';
import { CORE_PLUGIN_NAME } from '../rules/corePlugin.ts';
import { createChangeSet, type ChangeState } from './changeSet.ts';
import { LocationUtil } from '../utils/locationUtil.ts';
import type { Scope } from './scope.ts';

export interface RunRulesOptions {
  readonly project: ProjectModel;
  readonly scope: Scope;
  readonly config: ResolvedConfig;
  readonly base: string;
  readonly changes: () => ChangeState;
  readonly ruleFilter: ReadonlySet<string> | undefined;
}

interface LiveRule {
  readonly instance: RuleInstance;
  readonly visitors: Visitors;
}

const PARSE_ERROR = `${CORE_PLUGIN_NAME}/parse-error`;
const NO_GIT = `${CORE_PLUGIN_NAME}/no-git`;

export async function runRules(options: RunRulesOptions): Promise<Finding[]> {
  const { project, scope, config } = options;
  const findings: Finding[] = [];
  const needGit = new Set<string>();
  const levelAt = (instance: RuleInstance, location: Location) =>
    config.levelAt(instance, LocationUtil.toConfigLocation(location, project));

  const push = (
    instance: RuleInstance,
    location: Location,
    message: string,
    extra: { hint?: string; key?: string; related?: readonly Location[] } = {},
  ) => {
    const severity = levelAt(instance, location);
    const related = extra.related ?? [];
    if (!severity || (!scope.includes(location) && !related.some((item) => scope.includes(item)))) {
      return;
    }
    findings.push({
      ruleId: instance.ruleId,
      severity,
      message,
      hint: extra.hint,
      location,
      related,
      identity: `${instance.ruleId}|${location.kind}|${location.path}|${extra.key ?? message}`,
    });
  };

  const live: LiveRule[] = [];
  for (const instance of config.instances) {
    if (options.ruleFilter && !options.ruleFilter.has(instance.ruleId)) {
      continue;
    }
    const changes: ChangeSet = createChangeSet(options.base, options.changes, () =>
      needGit.add(instance.ruleId),
    );
    const context: RuleContext<unknown> = {
      id: instance.ruleId,
      options: instance.options,
      project,
      changes,
      report: (descriptor) =>
        push(instance, LocationUtil.toLocation(descriptor.at, project), descriptor.message, {
          hint: descriptor.hint,
          key: descriptor.key,
          related: descriptor.related?.map((item) => LocationUtil.toLocation(item, project)),
        }),
      isInScope: (at) => scope.includes(LocationUtil.toLocation(at, project)),
    };
    live.push({ instance, visitors: instance.rule.create(context) });
  }

  const using = (visitor: keyof Visitors) => live.filter((rule) => rule.visitors[visitor]);
  const appliesTo = (rules: readonly LiveRule[], location: Location) =>
    rules.filter((rule) => levelAt(rule.instance, location));
  const fileLocation = (file: ProjectFile): Location => ({ kind: 'file', path: file.path });

  const textRules = using('text');
  const astRules = using('ast');
  const sourceRules = [...using('module'), ...using('import'), ...astRules];
  const sources = scope.files.filter((file) => file.isSource);
  // Module and import rules can use cached module info; AST and text rules need the files, but
  // only where they are on, which overrides may limit to a few files.
  const textFiles = textRules.length
    ? scope.files.filter((file) => appliesTo(textRules, fileLocation(file)).length)
    : [];
  const needed = sourceRules.length
    ? sources.filter(
        (file) => project.needsText(file) || appliesTo(astRules, fileLocation(file)).length,
      )
    : [];
  await project.preload([...new Set([...textFiles, ...needed].map((file) => file.path))]);

  const fileRules = using('file');
  for (const file of scope.files) {
    for (const rule of appliesTo(fileRules, fileLocation(file))) {
      rule.visitors.file?.(file);
    }
  }
  const directoryRules = using('directory');
  for (const directory of scope.directories) {
    for (const rule of appliesTo(directoryRules, { kind: 'directory', path: directory.path })) {
      rule.visitors.directory?.(directory);
    }
  }
  const elementRules = using('element');
  for (const element of scope.elements) {
    for (const rule of appliesTo(elementRules, { kind: 'element', path: element.root })) {
      rule.visitors.element?.(element);
    }
  }
  for (const file of textFiles) {
    const text = project.textSync(file.path);
    if (text === undefined) {
      continue;
    }
    for (const rule of appliesTo(textRules, fileLocation(file))) {
      rule.visitors.text?.(file, text);
    }
  }
  if (sourceRules.length) {
    const moduleRules = using('module');
    const importRules = using('import');
    for (const file of sources) {
      const parsed = project.parsedSync(file);
      if (!parsed) {
        continue;
      }
      const location = fileLocation(file);
      for (const rule of appliesTo(moduleRules, location)) {
        rule.visitors.module?.(file, parsed.module);
      }
      const forImports = appliesTo(importRules, location);
      if (forImports.length) {
        for (const edge of project.edgesSync(file)) {
          for (const rule of forImports) {
            rule.visitors.import?.(edge);
          }
        }
      }
      const forAst = appliesTo(astRules, location);
      if (forAst.length) {
        const ast = parsed.ast();
        for (const rule of forAst) {
          rule.visitors.ast?.(file, ast);
        }
      }
    }
  }
  for (const rule of using('project')) {
    await rule.visitors.project?.(project);
  }

  const parseError = config.instances.find((instance) => instance.ruleId === PARSE_ERROR);
  if (parseError && (!options.ruleFilter || options.ruleFilter.has(PARSE_ERROR))) {
    for (const [path, errors] of project.parseErrors) {
      for (const error of errors) {
        push(
          parseError,
          { kind: 'file', path, line: error.line },
          `Cannot parse: ${error.message}`,
          {
            hint: 'Fix the syntax error so rules can check this file.',
          },
        );
      }
    }
  }
  const noGit = config.instances.find((instance) => instance.ruleId === NO_GIT);
  if (noGit && needGit.size) {
    push(
      noGit,
      { kind: 'project', path: '' },
      `${[...needGit].sort().join(', ')} need git, but ${project.root} is not in a git repository.`,
      { hint: 'Run pilotlint inside a git repository, or turn these rules off.', key: 'no-git' },
    );
  }
  return findings;
}
