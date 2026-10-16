import { definePlugin } from '@pilotlint/core';
import { allowedImports } from './rules/allowedImports.ts';
import { entryOnly } from './rules/entryOnly.ts';
import { noCycles } from './rules/noCycles.ts';
import { noEntryImport } from './rules/noEntryImport.ts';
import { noOrphans } from './rules/noOrphans.ts';
import { noUndeclaredDependency } from './rules/noUndeclaredDependency.ts';
import { noUnresolved } from './rules/noUnresolved.ts';
import { publicApi } from './rules/publicApi.ts';
import { restrictedGlobals } from './rules/restrictedGlobals.ts';
import { restrictedPackages } from './rules/restrictedPackages.ts';

export {
  allowedImports,
  entryOnly,
  noCycles,
  noEntryImport,
  noOrphans,
  noUndeclaredDependency,
  noUnresolved,
  publicApi,
  restrictedGlobals,
  restrictedPackages,
};
export type { Selector } from './models/optionSchemas.ts';

const boundaries = definePlugin({
  name: 'boundaries',
  rules: {
    'allowed-imports': allowedImports,
    'entry-only': entryOnly,
    'no-cycles': noCycles,
    'no-entry-import': noEntryImport,
    'no-orphans': noOrphans,
    'no-undeclared-dependency': noUndeclaredDependency,
    'no-unresolved': noUnresolved,
    'public-api': publicApi,
    'restricted-globals': restrictedGlobals,
    'restricted-packages': restrictedPackages,
  },
  configs: {
    recommended: {
      rules: {
        'boundaries/no-cycles': 'error',
        'boundaries/no-unresolved': 'error',
        'boundaries/no-undeclared-dependency': 'error',
      },
    },
  },
});

export default boundaries;
