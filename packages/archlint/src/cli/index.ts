#!/usr/bin/env node
import { stripVTControlCharacters } from 'node:util';
import { defineCommand, runCommand, runMain, showUsage } from 'citty';
import { logger, setLogLevel } from './logger.ts';
import { CliUtil } from './utils/cliUtil.ts';
import { PackageUtil } from './utils/packageUtil.ts';

const main = defineCommand({
  meta: {
    name: 'archlint',
    version: PackageUtil.version(),
    description: 'Fast, structure-agnostic architecture checks for TypeScript projects.',
  },
  args: {
    debug: {
      type: 'boolean',
      description: 'Enable debug logging',
    },
  },
  setup({ args }) {
    if (args.debug) {
      setLogLevel('debug');
      logger.debug('Debug logging enabled');
    }
  },
  subCommands: {
    check: () => import('./features/check/index.ts').then((module) => module.check),
    describe: () => import('./features/describe/index.ts').then((module) => module.describe),
    rules: () => import('./features/rules/index.ts').then((module) => module.rules),
  },
});

const rawArgs = process.argv.slice(2);
const [first] = rawArgs;
const wantsHelp = rawArgs.some((arg) => arg === '--help' || arg === '-h');
const wantsVersion = rawArgs.length === 1 && (first === '--version' || first === '-v');

if (wantsHelp || wantsVersion) {
  await runMain(main);
} else if (!rawArgs.length) {
  await showUsage(main);
  process.exitCode = CliUtil.exit.setup;
} else {
  // citty exits with 1 on invalid arguments, which archlint reserves for findings.
  try {
    await runCommand(main, { rawArgs });
  } catch (error) {
    logger.error(stripVTControlCharacters(error instanceof Error ? error.message : String(error)));
    logger.error('Run archlint --help for usage.');
    process.exitCode = CliUtil.exit.setup;
  }
}
