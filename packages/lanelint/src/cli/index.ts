#!/usr/bin/env node
import { enableCompileCache } from 'node:module';
import { stripVTControlCharacters } from 'node:util';
import { defineCommand, runCommand, runMain, showUsage } from 'citty';
import { logger, setLogLevel } from './logger.ts';
import { EXIT_CODES } from './constants/exitCodes.ts';
import { PackageService } from './services/packageService.ts';

// Node keeps the compiled code of the modules loaded from here on, so later runs start faster.
enableCompileCache();

const main = defineCommand({
  meta: {
    name: 'lanelint',
    version: PackageService.version(),
    description:
      'Keeps coding agents on course. A fast architecture linter for TypeScript projects.',
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
  process.exitCode = EXIT_CODES.setup;
} else {
  // citty exits with 1 on invalid arguments, which lanelint reserves for findings.
  try {
    await runCommand(main, { rawArgs });
  } catch (error) {
    logger.error(stripVTControlCharacters(error instanceof Error ? error.message : String(error)));
    logger.error('Run lanelint --help for usage.');
    process.exitCode = EXIT_CODES.setup;
  }
}
