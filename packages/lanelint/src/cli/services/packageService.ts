import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const version = (): string => {
  let directory = dirname(fileURLToPath(import.meta.url));
  for (let depth = 0; depth < 5; depth++) {
    try {
      const json = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8')) as {
        name?: string;
        version?: string;
      };
      if (json.name === 'lanelint' && json.version) {
        return json.version;
      }
    } catch {
      // Keep looking in the parent directory.
    }
    directory = dirname(directory);
  }
  return '0.0.0';
};

export const PackageService = {
  version,
};
