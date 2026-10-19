import { existsSync } from 'node:fs';
import { isAbsolute, normalize, relative, resolve } from 'pathe';
import type { ResolvedConfig } from '../config/resolveConfig.ts';
import { UsageError } from '../errors.ts';
import { GitService } from '../services/gitService.ts';
import { ModuleCacheService } from '../services/moduleCacheService.ts';
import type { Change } from '../models/changes.ts';
import type { FailOn, Finding } from '../models/finding.ts';
import type { WorkStats } from '../models/stats.ts';
import { ParseService } from '../services/parseService.ts';
import { createProject } from '../project/project.ts';
import { ResolutionCacheService } from '../services/resolutionCacheService.ts';
import { ResolveService } from '../services/resolveService.ts';
import { SnapshotService, type Snapshot } from '../services/snapshotService.ts';
import type { ChangeState } from './changeSet.ts';
import { runRules } from './runRules.ts';
import { createScope } from './scope.ts';

export interface CheckOptions {
  readonly config: ResolvedConfig;
  /** Files or directories to report on, absolute or relative to the working directory. */
  readonly paths?: readonly string[];
  /** Working directory for relative `paths`. Defaults to the project root. */
  readonly cwd?: string;
  /** Report only on files that differ from the base ref. */
  readonly changed?: boolean;
  /** Base ref for `changed`, `onlyNew`, and change rules. Defaults to `HEAD`. */
  readonly base?: string;
  /** Report only findings that do not exist at the base ref. */
  readonly onlyNew?: boolean;
  /** Run only these rule ids. */
  readonly rules?: readonly string[];
  /** Use these changes instead of asking git. Mainly for tests. */
  readonly changes?: readonly Change[];
  /** Overrides `failOn` from the config. */
  readonly failOn?: FailOn;
  /** Keep module info and resolutions between runs in `node_modules/.cache/pilotlint`. Defaults to `true`. */
  readonly cache?: boolean;
}

export interface CheckResult {
  readonly findings: readonly Finding[];
  readonly errorCount: number;
  readonly warningCount: number;
  readonly filesInScope: number;
  readonly durationMs: number;
  /** True when the findings reach the `failOn` threshold. */
  readonly failed: boolean;
  /** How much work the check did, counted over the working tree and, with `onlyNew`, the base. */
  readonly stats: Readonly<WorkStats>;
}

const compare = (a: Finding, b: Finding) =>
  a.location.path.localeCompare(b.location.path) ||
  (a.location.line ?? 0) - (b.location.line ?? 0) ||
  a.ruleId.localeCompare(b.ruleId) ||
  a.message.localeCompare(b.message);

const scopePaths = (root: string, cwd: string, paths: readonly string[]) =>
  paths.map((path) => {
    const absolute = resolve(cwd, path);
    const relativePath = relative(root, absolute);
    if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
      throw new UsageError(`${path} is outside the project root ${root}.`);
    }
    if (!existsSync(absolute)) {
      throw new UsageError(`${path} does not exist.`);
    }
    return normalize(relativePath) === '.' ? '' : normalize(relativePath);
  });

export async function check(options: CheckOptions): Promise<CheckResult> {
  const start = performance.now();
  const { config } = options;
  const root = config.root;
  const base = options.base ?? 'HEAD';
  const prefixes = options.paths?.length
    ? scopePaths(root, options.cwd ?? root, options.paths)
    : undefined;
  const ruleFilter = options.rules?.length ? new Set(options.rules) : undefined;
  for (const id of ruleFilter ?? []) {
    if (!config.rules.has(id)) {
      throw new UsageError(
        `Unknown rule "${id}". Run pilotlint rules list to see the active rules.`,
      );
    }
  }
  const filter = { include: config.include, ignore: config.ignore };
  const stats: WorkStats = {
    filesRead: 0,
    filesParsed: 0,
    modulesFromCache: 0,
    importsResolved: 0,
    resolutionsFromCache: 0,
  };
  const cache = options.cache ?? true;

  // Git and the module cache load concurrently. The file list comes from git when the project
  // is in a repository, so files git ignores are left out, and from the directories otherwise.
  const loadGit = async () => {
    const repo = await GitService.repository(root, base);
    if (!repo) {
      return { repo, files: undefined, changes: options.changes ?? [] };
    }
    const untracked = GitService.untrackedFiles(root);
    const [files, changes] = await Promise.all([
      GitService.workingFiles(root, untracked).catch(() => undefined),
      options.changes ?? GitService.changes(root, repo, untracked),
    ]);
    return { repo, files, changes };
  };
  const loadListing = async () => {
    const git = await loadGit();
    const listed = config.gitignore ? git.files?.paths : undefined;
    const listing = await SnapshotService.createWorkingTree(root, filter, stats, listed);
    const resolutions = cache
      ? await ResolutionCacheService.load(root, listing.paths)
      : ResolutionCacheService.memory();
    return { git, listing, resolutions };
  };
  const [{ git: loaded, listing, resolutions }, store] = await Promise.all([
    loadListing(),
    cache ? ModuleCacheService.load(root) : ModuleCacheService.memory(),
  ]);
  const git = {
    repo: loaded.repo,
    hashes: (cache && loaded.files?.hashes) || new Map<string, string>(),
    state: { available: !!loaded.repo || !!options.changes, changes: loaded.changes },
  };
  const working = SnapshotService.withHashes(listing, git.hashes);
  if ((options.onlyNew || (options.changed && !options.changes)) && !git.repo) {
    throw new UsageError('--changed and --new need a git repository.');
  }
  const changed = options.changed
    ? new Set(
        git.state.changes
          .filter((change) => change.status !== 'deleted')
          .map((change) => change.path),
      )
    : undefined;

  const parseCache = ParseService.createCache(store, stats);
  const resolver = ResolveService.create(stats, resolutions);
  const run = async (snapshot: Snapshot, changes: ChangeState) => {
    const project = createProject({
      snapshot,
      filter,
      elements: config.elements,
      tests: config.tests,
      configFile: config.configFile,
      parseCache,
      resolver,
    });
    const scope = createScope(project, prefixes, changed);
    const findings = await runRules({
      project,
      scope,
      config,
      base,
      changes: () => changes,
      ruleFilter,
    });
    return { findings, filesInScope: scope.files.length };
  };

  const current = await run(working, git.state);
  let findings = current.findings;
  if (options.onlyNew && git.repo) {
    const list = git.state.changes;
    const contents = await GitService.readAtRef(root, git.repo, SnapshotService.basePathsOf(list));
    stats.filesRead += contents.size;
    const atBase = SnapshotService.createAtRef(working, filter, list, contents);
    // At the base ref nothing has changed yet, so change rules report nothing there.
    const previous = await run(atBase, { available: true, changes: [] });
    const known = new Set(previous.findings.map((finding) => finding.identity));
    findings = findings.filter((finding) => !known.has(finding.identity));
  }

  await Promise.all([store.save(2 * working.paths.length + 1000), resolutions.save()]);

  findings = [...findings].sort(compare);
  const errorCount = findings.filter((finding) => finding.severity === 'error').length;
  const warningCount = findings.length - errorCount;
  const failOn = options.failOn ?? config.failOn;
  return {
    findings,
    errorCount,
    warningCount,
    filesInScope: current.filesInScope,
    durationMs: performance.now() - start,
    failed: failOn === 'never' ? false : failOn === 'warn' ? findings.length > 0 : errorCount > 0,
    stats,
  };
}
