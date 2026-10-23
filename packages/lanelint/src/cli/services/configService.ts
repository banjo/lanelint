import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import {
  ConfigError,
  resolveConfig,
  type LanelintConfig,
  type ResolvedConfig,
} from '@lanelint/core';
import { createJiti } from 'jiti';

const CONFIG_NAMES = ['ts', 'mts', 'cts', 'js', 'mjs', 'cjs'].map(
  (extension) => `lanelint.config.${extension}`,
);

/** The nearest lanelint config in the directory or its parents. */
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
        : `No lanelint config found in ${options.cwd} or its parents. Create lanelint.config.ts.`,
    );
  }
  const directory = dirname(configFile);
  let loaded: LanelintConfig | undefined;
  try {
    // jiti loads TypeScript configs in any package, including ones without `"type": "module"`
    // and with extensionless imports, where Node's own import warns or fails.
    const jiti = createJiti(configFile, { interopDefault: true, moduleCache: false });
    loaded = await jiti.import<LanelintConfig>(configFile, { default: true });
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

export const ConfigService = {
  find,
  load,
};
