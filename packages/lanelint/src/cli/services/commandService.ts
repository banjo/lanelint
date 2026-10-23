import { ConfigError, UsageError } from '@lanelint/core';
import { EXIT_CODES } from '../constants/exitCodes.ts';
import { logger } from '../logger.ts';

/** Runs a command body, sets the exit code, and reports setup problems with exit code 2. */
const run = async (body: () => Promise<number>): Promise<void> => {
  try {
    process.exitCode = await body();
  } catch (error) {
    if (error instanceof ConfigError || error instanceof UsageError) {
      logger.error(error.message);
    } else {
      logger.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
    }
    process.exitCode = EXIT_CODES.setup;
  }
};

export const CommandService = {
  run,
};
