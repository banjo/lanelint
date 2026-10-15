import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import {
  ConfigError,
  resolveConfig,
  type ArchlintConfig,
  type ResolvedConfig,
} from '@archlint/core';
import { loadConfig } from 'c12';

const CONFIG_NAMES = ['ts', 'mts', 'cts', 'js', 'mjs', 'cjs'].map(
  (extension) => `archlint.config.${extension}`,
);

/** The nearest archlint config in the directory or its parents. */
const find = (cwd: string): string | undefined => {
  for (let directory = resolve(cwd); ; directory = dirname(directory)) {
    for (const name of CONFIG_NAMES) {
      const path = join(directory, name);
      if (existsSync(path)) {
        return path;
      }
    }
    if (dirname(directory) === directory) {
      return undefined;
    }
  }
};

/** Loads and validates the config. Throws `ConfigError` when it is missing or invalid. */
const load = async (options: { cwd: string; config?: string }): Promise<ResolvedConfig> => {
  const configFile = options.config ? resolve(options.cwd, options.config) : find(options.cwd);
  if (!configFile || !existsSync(configFile)) {
    throw new ConfigError(
      options.config
        ? `Config file ${options.config} does not exist.`
        : `No archlint config found in ${options.cwd} or its parents. Create archlint.config.ts.`,
    );
  }
  const directory = dirname(configFile);
  let loaded: ArchlintConfig | undefined;
  try {
    const result = await loadConfig<ArchlintConfig & Record<string, unknown>>({
      cwd: directory,
      configFile,
      rcFile: false,
      globalRc: false,
      packageJson: false,
      dotenv: false,
      envName: false,
      // archlint's own `extends` holds config objects, not c12 layers.
      extend: false,
      configFileRequired: true,
    });
    loaded = result.config;
  } catch (error) {
    throw new ConfigError(
      `Cannot load ${configFile}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!loaded || typeof loaded !== 'object') {
    throw new ConfigError(`${configFile} must export a config object as its default export.`);
  }
  return resolveConfig(loaded, { directory, configFile });
};

export const ConfigUtil = {
  find,
  load,
};
