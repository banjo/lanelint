import { definePlugin } from '@pilotlint/core';
import { exportMatchesFilename, exportNamePattern } from './rules/exports.ts';
import { forbiddenDirectories, forbiddenFiles } from './rules/forbidden.ts';
import { directoryCase, fileNameCase } from './rules/nameCase.ts';
import { noDefaultExport } from './rules/noDefaultExport.ts';
import { noSuppressions } from './rules/noSuppressions.ts';
import { fileNamePattern, rootOnlyFiles } from './rules/placement.ts';
import { companionFiles, requiredFiles } from './rules/required.ts';

export {
  companionFiles,
  directoryCase,
  exportMatchesFilename,
  exportNamePattern,
  fileNameCase,
  fileNamePattern,
  forbiddenDirectories,
  forbiddenFiles,
  noDefaultExport,
  noSuppressions,
  requiredFiles,
  rootOnlyFiles,
};

const conventions = definePlugin({
  name: 'conventions',
  rules: {
    'companion-files': companionFiles,
    'directory-case': directoryCase,
    'export-matches-filename': exportMatchesFilename,
    'export-name-pattern': exportNamePattern,
    'file-name-case': fileNameCase,
    'file-name-pattern': fileNamePattern,
    'forbidden-directories': forbiddenDirectories,
    'forbidden-files': forbiddenFiles,
    'no-default-export': noDefaultExport,
    'no-suppressions': noSuppressions,
    'required-files': requiredFiles,
    'root-only-files': rootOnlyFiles,
  },
  configs: {
    recommended: {
      rules: {
        'conventions/no-suppressions': 'error',
      },
    },
  },
});

export default conventions;
