import { definePlugin } from '@pilotlint/core';
import { noManualEdit, requiresChange } from './rules/changes.ts';

export { noManualEdit, requiresChange };

const changes = definePlugin({
  name: 'changes',
  description:
    'Rules about files that must or must not change together. They compare the working tree with a git ref.',
  rules: {
    'no-manual-edit': noManualEdit,
    'requires-change': requiresChange,
  },
});

export default changes;
