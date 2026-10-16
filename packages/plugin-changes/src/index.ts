import { definePlugin } from '@pilotlint/core';
import { noManualEdit, requiresChange } from './rules/changes.ts';

export { noManualEdit, requiresChange };

const changes = definePlugin({
  name: 'changes',
  rules: {
    'no-manual-edit': noManualEdit,
    'requires-change': requiresChange,
  },
});

export default changes;
