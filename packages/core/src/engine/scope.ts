import type { Location } from '../models/finding.ts';
import type { ProjectDirectory, ProjectFile, Element } from '../models/project.ts';
import type { ProjectModel } from '../project/project.ts';

export interface Scope {
  readonly all: boolean;
  readonly files: readonly ProjectFile[];
  readonly directories: readonly ProjectDirectory[];
  readonly elements: readonly Element[];
  includes(location: Location): boolean;
}

const under = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

/**
 * Which findings are shown. `prefixes` limits to paths, `changed` to changed files.
 * Findings on the project are always in scope.
 */
export function createScope(
  project: ProjectModel,
  prefixes: readonly string[] | undefined,
  changed: ReadonlySet<string> | undefined,
): Scope {
  const limited = prefixes?.filter((prefix) => prefix !== '');
  const byPrefix = (path: string) =>
    !limited?.length || limited.some((prefix) => under(path, prefix));
  if (!limited?.length && !changed) {
    return {
      all: true,
      files: project.files,
      directories: project.directories,
      elements: project.elements,
      includes: () => true,
    };
  }
  const fileIn = (path: string) => (!changed || changed.has(path)) && byPrefix(path);
  const files = project.files.filter((file) => fileIn(file.path));
  const ancestors = new Set<string>();
  for (const file of files) {
    for (
      let directory = file.directory;
      directory;
      directory = directory.slice(0, Math.max(0, directory.lastIndexOf('/')))
    ) {
      ancestors.add(directory);
    }
  }
  const directoryIn = (path: string) =>
    changed ? ancestors.has(path) && byPrefix(path) : byPrefix(path);
  const elementIn = (root: string) =>
    changed
      ? ancestors.has(root)
      : byPrefix(root) || (limited ?? []).some((prefix) => under(prefix, root));
  return {
    all: false,
    files,
    directories: project.directories.filter((directory) => directoryIn(directory.path)),
    elements: project.elements.filter((element) => elementIn(element.root)),
    includes(location) {
      switch (location.kind) {
        case 'project':
          return true;
        case 'directory':
          return directoryIn(location.path);
        case 'element':
          return elementIn(location.path);
        default:
          return fileIn(location.path);
      }
    },
  };
}
