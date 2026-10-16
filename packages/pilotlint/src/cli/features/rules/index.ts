import { defineCommand } from 'citty';

export const rules = defineCommand({
  meta: {
    name: 'rules',
    description: 'List, explain, and document rules',
  },
  subCommands: {
    list: () => import('./commands/list.ts').then((module) => module.list),
    explain: () => import('./commands/explain.ts').then((module) => module.explain),
    docs: () => import('./commands/docs.ts').then((module) => module.docs),
  },
});
