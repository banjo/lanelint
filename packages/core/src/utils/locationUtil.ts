import { normalize } from 'pathe';
import type { ConfigLocation } from '../config/resolveConfig.ts';
import type { Location } from '../models/finding.ts';
import type { LocationInput } from '../models/rule.ts';
import type { ProjectModel } from '../project/project.ts';

const toLocation = (at: LocationInput, project: ProjectModel): Location => {
  if (at === 'project') {
    return { kind: 'project', path: '' };
  }
  if ('kind' in at) {
    switch (at.kind) {
      case 'file':
        return { kind: 'file', path: at.path };
      case 'directory':
        return { kind: 'directory', path: at.path };
      case 'element':
        return { kind: 'element', path: at.root };
      case 'edge':
        return { kind: 'file', path: at.from.path, line: at.line };
    }
  }
  const path = normalize(at.path).replace(/^\.\//, '').replace(/\/$/, '');
  const kind = project.file(path) ? 'file' : project.directory(path) ? 'directory' : 'path';
  return { kind, path, line: at.line, column: at.column };
};

const toConfigLocation = (location: Location, project: ProjectModel): ConfigLocation => {
  switch (location.kind) {
    case 'file':
      return { ...location, elementType: project.file(location.path)?.element?.type };
    case 'directory':
      return { ...location, elementType: project.directory(location.path)?.element?.type };
    case 'element':
      return { ...location, elementType: project.element(location.path)?.type };
    case 'path':
      return { ...location, elementType: project.elementAt(location.path)?.type };
    default:
      return { ...location, elementType: undefined };
  }
};

export const LocationUtil = {
  toConfigLocation,
  toLocation,
};
