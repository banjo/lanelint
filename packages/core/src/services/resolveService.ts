import { isBuiltin } from 'node:module';
import { dirname } from 'pathe';
import { ResolverFactory } from 'oxc-resolver';
import { SOURCE_EXTENSIONS } from '../constants/defaults.ts';

export type Resolution = { readonly builtin: true } | { readonly path: string } | undefined;

export interface Resolver {
  /** The resolved absolute path, a builtin module, or `undefined` when it cannot be resolved. */
  resolve(fromAbsolute: string, specifier: string): Resolution;
}

const BUILTIN = { builtin: true } as const;

const create = (): Resolver => {
  const options = {
    extensions: [...SOURCE_EXTENSIONS, '.d.ts', '.json', '.node'],
    extensionAlias: {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.jsx': ['.tsx', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
      '.cjs': ['.cts', '.cjs'],
    },
    conditionNames: ['types', 'import', 'require', 'node', 'default'],
    mainFields: ['types', 'module', 'main'],
    symlinks: true,
  };
  const factory = new ResolverFactory({ ...options, tsconfig: 'auto' });
  // Used when a tsconfig cannot be read, for example when its `extends` target is missing.
  let withoutTsconfig: ResolverFactory | undefined;
  const cache = new Map<string, Resolution>();
  return {
    resolve(fromAbsolute, specifier) {
      if (isBuiltin(specifier)) {
        return BUILTIN;
      }
      const directory = dirname(fromAbsolute);
      const key = `${directory}\0${specifier}`;
      if (cache.has(key)) {
        return cache.get(key);
      }
      let result = factory.resolveFileSync(fromAbsolute, specifier);
      if (result.error && /tsconfig/i.test(result.error)) {
        withoutTsconfig ??= new ResolverFactory(options);
        result = withoutTsconfig.sync(directory, specifier);
      }
      const resolved: Resolution = result.builtin
        ? BUILTIN
        : result.path
          ? { path: result.path }
          : undefined;
      cache.set(key, resolved);
      return resolved;
    },
  };
};

export const ResolveService = {
  create,
};
