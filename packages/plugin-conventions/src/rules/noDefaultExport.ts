import { defineRule } from '@pilotlint/core';

export const noDefaultExport = defineRule({
  meta: {
    description: 'Use named exports instead of default exports.',
    severity: 'error',
    docs: [
      'Named exports keep names consistent across imports and make re-exports and refactors',
      'reliable. Allow default exports where a tool needs them, such as config files or stories,',
      'with an override that turns this rule off for those files.',
      '',
      'To fix a finding, export the value by name and update the imports.',
    ].join('\n'),
  },
  create: (context) => ({
    module(file, module) {
      for (const entry of module.exports) {
        if (entry.name === 'default') {
          context.report({
            at: { path: file.path, line: entry.line },
            message: 'Use a named export instead of a default export.',
            hint: 'Export the value by name and update the imports.',
          });
        }
      }
    },
  }),
});
