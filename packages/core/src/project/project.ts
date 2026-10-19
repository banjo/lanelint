import { basename, dirname, isAbsolute, join, normalize, relative } from 'pathe';
import type { AstInfo, ImportEdge, ImportTarget, ModuleInfo } from '../models/module.ts';
import type {
  Element,
  ElementInfo,
  PackageInfo,
  ProjectDirectory,
  ProjectFile,
} from '../models/project.ts';
import type { Graph, ProjectApi } from '../models/rule.ts';
import { DEFAULT_IGNORE, SOURCE_EXTENSIONS } from '../constants/defaults.ts';
import { GlobUtil } from '../utils/globUtil.ts';
import { ElementUtil, type CompiledElement, type ElementMatch } from '../utils/elementUtil.ts';
import type { ParseCache, ParsedFile, ParseError } from '../services/parseService.ts';
import type { Resolver } from '../services/resolveService.ts';
import type { FileFilter, Snapshot } from '../services/snapshotService.ts';

export interface ProjectOptions {
  readonly snapshot: Snapshot;
  readonly filter: FileFilter;
  readonly elements: readonly CompiledElement[];
  readonly tests: readonly string[];
  readonly configFile: string | undefined;
  readonly parseCache: ParseCache;
  readonly resolver: Resolver;
}

/** The project API given to rules, plus what the engine needs to drive the tiers. */
export interface ProjectModel extends ProjectApi {
  readonly sourceFiles: readonly ProjectFile[];
  readonly parseErrors: ReadonlyMap<string, readonly ParseError[]>;
  /** Reads files concurrently so later synchronous access is cheap. */
  preload(paths: readonly string[]): Promise<void>;
  /** Whether a source file must be read for its module info, because the cache does not have it. */
  needsText(file: ProjectFile): boolean;
  textSync(path: string): string | undefined;
  parsedSync(file: ProjectFile): ParsedFile | undefined;
  edgesSync(file: ProjectFile): readonly ImportEdge[];
}

interface WorkspacePackage {
  readonly info: PackageInfo;
  readonly source: string | undefined;
}

const parentOf = (path: string) => {
  const parent = dirname(path);
  return parent === '.' ? '' : parent;
};

const join2 = (directory: string, name: string) => (directory ? `${directory}/${name}` : name);

const stemOf = (name: string) => {
  const dot = name.indexOf('.', name.startsWith('.') ? 1 : 0);
  return dot === -1 ? name : name.slice(0, dot);
};

const extensionOf = (name: string) => {
  const dot = name.lastIndexOf('.');
  return dot <= 0 ? '' : name.slice(dot);
};

const isBare = (specifier: string) =>
  !specifier.startsWith('.') && !specifier.startsWith('/') && !/^[A-Za-z]:[\\/]/.test(specifier);

const packageNameOf = (specifier: string) => {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] ?? specifier);
};

const record = (value: unknown): Readonly<Record<string, string>> =>
  value && typeof value === 'object' ? (value as Record<string, string>) : {};

const packageInfoOf = (directory: string, text: string | undefined) => {
  if (text === undefined) {
    return undefined;
  }
  try {
    const json = JSON.parse(text) as Record<string, unknown>;
    const info: PackageInfo = {
      name: typeof json.name === 'string' ? json.name : undefined,
      directory,
      dependencies: record(json.dependencies),
      devDependencies: record(json.devDependencies),
      peerDependencies: record(json.peerDependencies),
      optionalDependencies: record(json.optionalDependencies),
      exports: json.exports,
    };
    return { info, source: typeof json.source === 'string' ? json.source : undefined };
  } catch {
    return undefined;
  }
};

export function createProject(options: ProjectOptions): ProjectModel {
  const { snapshot, resolver, parseCache } = options;
  const root = snapshot.root;
  const isTest = GlobUtil.matcher(options.tests);
  const include = GlobUtil.matcher(options.filter.include);
  const ignore = GlobUtil.matcher([...DEFAULT_IGNORE, ...options.filter.ignore]);

  const matches = new Map<string, ElementMatch | undefined>();
  const matchDirectory = (directory: string) => {
    if (!matches.has(directory)) {
      matches.set(directory, ElementUtil.match(options.elements, directory));
    }
    return matches.get(directory);
  };
  const infoOf = (match: ElementMatch, relativePath: string, isFile: boolean): ElementInfo => ({
    type: match.element.definition.type,
    id: match.root,
    root: match.root,
    captures: match.captures,
    relativePath,
    isEntry: isFile && GlobUtil.matches(relativePath, match.element.entries),
  });
  const fileElementAt = (path: string): ElementInfo | undefined => {
    const match = matchDirectory(parentOf(path));
    return match && infoOf(match, path.slice(match.root.length + 1), true);
  };
  const directoryElementAt = (path: string): ElementInfo | undefined => {
    const match = matchDirectory(path);
    return (
      match && infoOf(match, path === match.root ? '' : path.slice(match.root.length + 1), false)
    );
  };
  /** A path that does not exist is a directory when its name has no extension. */
  const elementAt = (path: string): ElementInfo | undefined => {
    const file = files.get(path);
    if (file) {
      return file.element;
    }
    return directories.has(path) || !extensionOf(basename(path))
      ? directoryElementAt(path)
      : fileElementAt(path);
  };

  const files = new Map<string, ProjectFile>();
  const directories = new Map<string, ProjectDirectory>();
  const addDirectory = (path: string) => {
    if (!path || directories.has(path)) {
      return;
    }
    directories.set(path, {
      kind: 'directory',
      path,
      absolutePath: join(root, path),
      name: basename(path),
      parent: parentOf(path) || undefined,
      element: directoryElementAt(path),
    });
    addDirectory(parentOf(path));
  };
  for (const path of snapshot.paths) {
    const name = basename(path);
    const directory = parentOf(path);
    const extension = extensionOf(name);
    files.set(path, {
      kind: 'file',
      path,
      absolutePath: join(root, path),
      name,
      stem: stemOf(name),
      extension,
      directory,
      isSource: SOURCE_EXTENSIONS.includes(extension),
      isTest: isTest(path),
      element: fileElementAt(path),
    });
    addDirectory(directory);
  }
  const fileList = [...files.values()];
  const sourceFiles = fileList.filter((file) => file.isSource);
  const directoryList = [...directories.values()].sort((a, b) => a.path.localeCompare(b.path));

  const elementMap = new Map<string, Element>();
  for (const file of fileList) {
    const info = file.element;
    if (!info) {
      continue;
    }
    let element = elementMap.get(info.id);
    if (!element) {
      const match = matchDirectory(parentOf(file.path));
      element = {
        kind: 'element',
        type: info.type,
        id: info.id,
        root: info.root,
        captures: info.captures,
        description: match?.element.definition.description,
        entries: match?.element.entries ?? [],
        files: [],
        entryFiles: [],
      };
      elementMap.set(info.id, element);
    }
    (element.files as ProjectFile[]).push(file);
    if (info.isEntry) {
      (element.entryFiles as ProjectFile[]).push(file);
    }
  }
  const elementList = [...elementMap.values()].sort((a, b) => a.root.localeCompare(b.root));

  const texts = new Map<string, string | undefined>();
  const textSync = (path: string) => {
    if (!texts.has(path)) {
      texts.set(path, snapshot.readSync(path));
    }
    return texts.get(path);
  };
  const preload = async (paths: readonly string[]) => {
    const missing = paths.filter((path) => !texts.has(path));
    const contents = await Promise.all(missing.map((path) => snapshot.read(path)));
    missing.forEach((path, index) => texts.set(path, contents[index]));
  };

  const packages = new Map<string, WorkspacePackage | undefined>();
  const packageAt = (directory: string) => {
    if (!packages.has(directory)) {
      const path = join2(directory, 'package.json');
      const text = snapshot.has(path) ? textSync(path) : snapshot.readSync(path);
      packages.set(directory, packageInfoOf(directory, text));
    }
    return packages.get(directory);
  };
  const packageOf = (at: ProjectFile | string) => {
    let directory =
      typeof at === 'string' ? (files.get(at)?.directory ?? parentOf(at)) : at.directory;
    for (;;) {
      const found = packageAt(directory);
      if (found || !directory) {
        return found?.info;
      }
      directory = parentOf(directory);
    }
  };
  let workspace: Map<string, WorkspacePackage> | undefined;
  const workspacePackageOf = (name: string) => {
    if (!workspace) {
      workspace = new Map();
      for (const file of fileList) {
        if (file.name === 'package.json') {
          const found = packageAt(file.directory);
          if (found?.info.name) {
            workspace.set(found.info.name, found);
          }
        }
      }
    }
    return workspace.get(name);
  };

  const firstFile = (candidates: readonly string[]) => {
    for (const candidate of candidates) {
      const file = files.get(candidate);
      if (file) {
        return file;
      }
    }
    return undefined;
  };
  const candidatesOf = (base: string) => {
    const stripped = base.replace(/\.(?:[cm]?js|jsx)$/, '');
    return [
      base,
      ...SOURCE_EXTENSIONS.map((extension) => `${stripped}${extension}`),
      ...SOURCE_EXTENSIONS.map((extension) => `${base}/index${extension}`),
    ];
  };
  const workspaceTarget = (specifier: string): ImportTarget | undefined => {
    const name = packageNameOf(specifier);
    const found = workspacePackageOf(name);
    if (!found) {
      return undefined;
    }
    const directory = found.info.directory;
    const subpath = specifier.slice(name.length).replace(/^\//, '');
    const file = subpath
      ? firstFile([
          ...candidatesOf(join2(directory, subpath)),
          ...candidatesOf(join2(directory, `src/${subpath}`)),
        ])
      : firstFile([
          ...(found.source ? [normalize(join2(directory, found.source))] : []),
          ...candidatesOf(join2(directory, 'src/index')),
          ...candidatesOf(join2(directory, 'index')),
        ]);
    return file && { type: 'internal', file };
  };
  const fallbackTarget = (from: ProjectFile, specifier: string): ImportTarget | undefined => {
    if (specifier.startsWith('.')) {
      const file = firstFile(candidatesOf(normalize(join2(from.directory, specifier))));
      return file && { type: 'internal', file };
    }
    return isBare(specifier) ? workspaceTarget(specifier) : undefined;
  };
  const targetOf = (from: ProjectFile, specifier: string): ImportTarget => {
    const resolved = resolver.resolve(from.absolutePath, specifier);
    if (resolved && 'builtin' in resolved) {
      return { type: 'builtin', module: specifier.replace(/^node:/, '') };
    }
    if (resolved) {
      const path = relative(root, resolved.path);
      const outside = path.startsWith('..') || isAbsolute(path);
      if (!outside && !path.split('/').includes('node_modules')) {
        const file = files.get(path);
        if (file) {
          return { type: 'internal', file };
        }
        const fallback = fallbackTarget(from, specifier);
        if (fallback) {
          return fallback;
        }
        // In the project's file set but missing from this snapshot: added after the base ref.
        return include(path) && !ignore(path) ? { type: 'unresolved' } : { type: 'excluded', path };
      }
      if (isBare(specifier)) {
        const name = packageNameOf(specifier);
        return (
          workspaceTarget(specifier) ?? {
            type: 'external',
            package: name,
            path: specifier.slice(name.length + 1) || undefined,
          }
        );
      }
      return { type: 'excluded', path };
    }
    return fallbackTarget(from, specifier) ?? { type: 'unresolved' };
  };

  const parsed = new Map<string, ParsedFile | undefined>();
  const parseErrors = new Map<string, readonly ParseError[]>();
  const parsedSync = (file: ProjectFile) => {
    if (!file.isSource) {
      return undefined;
    }
    if (!parsed.has(file.path)) {
      const result = parseCache.parse(file, snapshot.hashOf(file.path), () => textSync(file.path));
      if (result?.errors.length) {
        parseErrors.set(file.path, result.errors);
      }
      parsed.set(file.path, result);
    }
    return parsed.get(file.path);
  };

  /** Whether a file must be read for its module info, because the cache does not have it. */
  const needsText = (file: ProjectFile) =>
    !parsed.has(file.path) && !parseCache.has(snapshot.hashOf(file.path), file.extension);

  const edges = new Map<string, readonly ImportEdge[]>();
  const edgesSync = (file: ProjectFile) => {
    let list = edges.get(file.path);
    if (!list) {
      const module = parsedSync(file)?.module;
      list = (module?.imports ?? []).map((entry) => ({
        kind: 'edge',
        from: file,
        specifier: entry.specifier,
        line: entry.line,
        syntax: entry.syntax,
        typeOnly: entry.typeOnly,
        names: entry.names,
        reexport: entry.reexport,
        target: targetOf(file, entry.specifier),
      }));
      edges.set(file.path, list);
    }
    return list;
  };

  let graph: Graph | undefined;
  const fileOf = (at: ProjectFile | string) => (typeof at === 'string' ? at : at.path);

  return {
    root,
    configFile: options.configFile,
    files: fileList,
    sourceFiles,
    directories: directoryList,
    elements: elementList,
    parseErrors,
    file: (path) => files.get(path),
    directory: (path) => directories.get(path),
    element: (id) => elementMap.get(id),
    exists: (path) => files.has(path) || directories.has(path),
    elementAt,
    packageOf,
    workspacePackage: (name) => workspacePackageOf(name)?.info,
    preload,
    needsText,
    textSync,
    parsedSync,
    edgesSync,
    async read(path) {
      await preload([path]);
      return textSync(path);
    },
    async module(file: ProjectFile): Promise<ModuleInfo | undefined> {
      if (needsText(file)) {
        await preload([file.path]);
      }
      return parsedSync(file)?.module;
    },
    async ast(file: ProjectFile): Promise<AstInfo | undefined> {
      await preload([file.path]);
      return parsedSync(file)?.ast();
    },
    async importsOf(file) {
      if (needsText(file)) {
        await preload([file.path]);
      }
      return edgesSync(file);
    },
    async graph() {
      if (!graph) {
        await preload(sourceFiles.filter(needsText).map((file) => file.path));
        const all = sourceFiles.flatMap((file) => edgesSync(file));
        const importers = new Map<string, ImportEdge[]>();
        for (const edge of all) {
          if (edge.target.type === 'internal') {
            const list = importers.get(edge.target.file.path) ?? [];
            list.push(edge);
            importers.set(edge.target.file.path, list);
          }
        }
        graph = {
          edges: all,
          importsOf: (at) => {
            const file = files.get(fileOf(at));
            return file ? edgesSync(file) : [];
          },
          importersOf: (at) => importers.get(fileOf(at)) ?? [],
        };
      }
      return graph;
    },
  };
}
