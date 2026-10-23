import { isAbsolute, normalize, relative, resolve } from 'pathe';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import type {
  AnyPlugin,
  LanelintConfig,
  ConfigFragment,
  ElementDefinition,
  OverrideConfig,
  RuleEntry,
} from '../models/config.ts';
import type { FailOn, Level, Location } from '../models/finding.ts';
import type { AnyRule } from '../models/rule.ts';
import { DEFAULT_TESTS } from '../constants/defaults.ts';
import { ConfigError } from '../errors.ts';
import { ElementUtil, type CompiledElement } from '../utils/elementUtil.ts';
import { createCorePlugin, CORE_PLUGIN_NAME } from '../rules/corePlugin.ts';
import { GlobUtil } from '../utils/globUtil.ts';

interface Entry {
  readonly level: Level;
  readonly hasInput: boolean;
  readonly input: unknown;
}

export interface ResolvedEntry extends Entry {
  readonly optionsKey: string;
}

export interface ResolvedOverride {
  readonly index: number;
  readonly description: string | undefined;
  readonly files: readonly string[] | undefined;
  readonly ignore: readonly string[] | undefined;
  readonly elements: readonly string[] | undefined;
  readonly rules: ReadonlyMap<string, Entry>;
}

export interface RuleInstance {
  readonly ruleId: string;
  readonly rule: AnyRule;
  readonly optionsKey: string;
  readonly options: unknown;
}

/** A location plus the element type that overrides match against. */
export interface ConfigLocation extends Location {
  readonly elementType: string | undefined;
}

export interface ResolvedConfig {
  readonly root: string;
  /** Config file relative to the root. */
  readonly configFile: string | undefined;
  readonly include: readonly string[];
  readonly ignore: readonly string[];
  readonly gitignore: boolean;
  readonly tests: readonly string[];
  readonly failOn: FailOn;
  readonly elementDefinitions: readonly ElementDefinition[];
  readonly elements: readonly CompiledElement[];
  /** Every plugin, starting with the core plugin. */
  readonly plugins: readonly AnyPlugin[];
  readonly rules: ReadonlyMap<string, AnyRule>;
  readonly base: ReadonlyMap<string, ResolvedEntry>;
  readonly overrides: readonly ResolvedOverride[];
  readonly instances: readonly RuleInstance[];
  /** Effective entries at a location: base entries with matching overrides applied. */
  entriesAt(location: ConfigLocation): ReadonlyMap<string, ResolvedEntry>;
  /** Level of an instance at a location, or `undefined` when another instance or nothing applies. */
  levelAt(instance: RuleInstance, location: ConfigLocation): Exclude<Level, 'off'> | undefined;
  /** Validated options of a rule for an options key. */
  optionsOf(ruleId: string, optionsKey: string): unknown;
}

export interface ResolveConfigOptions {
  /** Directory the config was loaded from. Defaults to the working directory. */
  readonly directory?: string;
  /** Absolute path of the config file. */
  readonly configFile?: string;
}

const LEVELS: readonly Level[] = ['off', 'warn', 'error'];

const keyOf = (entry: Entry) => (entry.hasInput ? JSON.stringify(entry.input) : '');

const normalizeEntry = (id: string, value: RuleEntry, errors: string[]): Entry | undefined => {
  const [level, ...rest] = Array.isArray(value) ? value : [value];
  if (!LEVELS.includes(level as Level)) {
    errors.push(
      `Rule "${id}" has an invalid level ${JSON.stringify(level)}. Use off, warn, or error.`,
    );
    return undefined;
  }
  if (rest.length > 1) {
    errors.push(`Rule "${id}" has more than one options value.`);
  }
  return { level: level as Level, hasInput: rest.length > 0, input: rest[0] };
};

const apply = (previous: Entry | undefined, next: Entry): Entry => ({
  level: next.level,
  hasInput: next.hasInput || (previous?.hasInput ?? false),
  input: next.hasInput ? next.input : previous?.input,
});

const validate = async (
  id: string,
  rule: AnyRule,
  entry: Entry,
  errors: string[],
): Promise<unknown> => {
  const schema: StandardSchemaV1 | undefined = rule.options;
  if (!schema) {
    if (entry.hasInput) {
      errors.push(`Rule "${id}" takes no options.`);
    }
    return undefined;
  }
  const result = await schema['~standard'].validate(entry.input);
  if (result.issues) {
    for (const issue of result.issues) {
      const path = (issue.path ?? [])
        .map((segment) => String(typeof segment === 'object' ? segment.key : segment))
        .join('.');
      errors.push(`Rule "${id}" has invalid options${path ? ` at ${path}` : ''}: ${issue.message}`);
    }
    return undefined;
  }
  return result.value;
};

const overrideMatches = (override: ResolvedOverride, location: ConfigLocation) => {
  if (location.kind === 'project') {
    return false;
  }
  if (override.files && !GlobUtil.matches(location.path, override.files)) {
    return false;
  }
  if (override.ignore && GlobUtil.matches(location.path, override.ignore)) {
    return false;
  }
  return !override.elements || override.elements.includes(location.elementType ?? '');
};

export async function resolveConfig(
  config: LanelintConfig,
  options: ResolveConfigOptions = {},
): Promise<ResolvedConfig> {
  const errors: string[] = [];
  const directory = resolve(options.directory ?? process.cwd());
  const root = config.root ? resolve(directory, config.root) : directory;
  const configFile = options.configFile
    ? relative(root, resolve(directory, options.configFile))
    : undefined;
  const fragments: readonly ConfigFragment[] = config.extends ?? [];

  const plugins = new Map<string, AnyPlugin>();
  const registerPlugin = (plugin: AnyPlugin) => {
    const existing = plugins.get(plugin.name);
    if (existing && existing !== plugin) {
      errors.push(`Two different plugins are named "${plugin.name}".`);
    }
    if (plugin.name === CORE_PLUGIN_NAME && existing !== plugin) {
      errors.push(`The plugin name "${CORE_PLUGIN_NAME}" is reserved.`);
    }
    plugins.set(plugin.name, plugin);
  };
  for (const fragment of fragments) {
    fragment.plugins?.forEach(registerPlugin);
  }
  config.plugins?.forEach(registerPlugin);

  let resolved: ResolvedConfig | undefined;
  const corePlugin = createCorePlugin(() => {
    if (!resolved) {
      throw new Error('The config is not resolved yet.');
    }
    return resolved;
  });
  const rules = new Map<string, AnyRule>();
  for (const plugin of [corePlugin, ...plugins.values()]) {
    for (const [key, rule] of Object.entries(plugin.rules)) {
      rules.set(`${plugin.name}/${key}`, rule);
    }
  }

  const known = (id: string) => {
    if (rules.has(id)) {
      return true;
    }
    const prefix = id.includes('/') ? id.slice(0, id.indexOf('/')) : id;
    errors.push(
      plugins.has(prefix) || prefix === CORE_PLUGIN_NAME
        ? `Unknown rule "${id}".`
        : `Unknown rule "${id}". Is the plugin "${prefix}" listed in plugins?`,
    );
    return false;
  };
  const entriesOf = (record: Readonly<Record<string, RuleEntry | undefined>> | undefined) => {
    const result = new Map<string, Entry>();
    for (const [id, value] of Object.entries(record ?? {})) {
      if (value === undefined || !known(id)) {
        continue;
      }
      const entry = normalizeEntry(id, value, errors);
      if (entry) {
        result.set(id, entry);
      }
    }
    return result;
  };

  const base = new Map<string, Entry>();
  for (const [key, rule] of Object.entries(corePlugin.rules)) {
    base.set(`${CORE_PLUGIN_NAME}/${key}`, {
      level: rule.meta.severity,
      hasInput: false,
      input: undefined,
    });
  }
  const rawOverrides: OverrideConfig[] = [];
  for (const fragment of [...fragments, config as ConfigFragment]) {
    for (const [id, entry] of entriesOf(fragment.rules)) {
      base.set(id, apply(base.get(id), entry));
    }
    rawOverrides.push(...(fragment.overrides ?? []));
  }
  const overrides = rawOverrides.map((override, index): ResolvedOverride => ({
    index,
    description: override.description,
    files: override.files,
    ignore: override.ignore,
    elements: override.elements,
    rules: entriesOf(override.rules),
  }));

  const elementDefinitions = [
    ...(config.elements ?? []),
    ...[...fragments].reverse().flatMap((fragment) => fragment.elements ?? []),
  ];
  let elements: CompiledElement[] = [];
  try {
    elements = ElementUtil.compile(elementDefinitions);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  const elementTypes = new Set(elementDefinitions.map((element) => element.type));
  for (const override of overrides) {
    for (const type of override.elements ?? []) {
      if (!elementTypes.has(type)) {
        errors.push(`An override references the element type "${type}", which is not defined.`);
      }
    }
  }

  // Every distinct options value a rule can see somewhere becomes one instance.
  const variants = new Map<string, Map<string, Entry>>();
  const addVariant = (id: string, entry: Entry) => {
    if (entry.level === 'off') {
      return;
    }
    const list = variants.get(id) ?? new Map<string, Entry>();
    list.set(keyOf(entry), entry);
    variants.set(id, list);
  };
  for (const [id, entry] of base) {
    if (entry.level === 'off' && id === `${CORE_PLUGIN_NAME}/config-changed`) {
      errors.push(`"${id}" cannot be turned off.`);
    }
    addVariant(id, entry);
  }
  for (const override of overrides) {
    for (const [id, entry] of override.rules) {
      if (entry.level === 'off' && id === `${CORE_PLUGIN_NAME}/config-changed`) {
        errors.push(`"${id}" cannot be turned off.`);
      }
      addVariant(id, apply(base.get(id), entry));
    }
  }
  const instances: RuleInstance[] = [];
  const validated = new Map<string, unknown>();
  for (const [id, entries] of variants) {
    const rule = rules.get(id);
    if (!rule) {
      continue;
    }
    for (const [optionsKey, entry] of entries) {
      const before = errors.length;
      const value = await validate(id, rule, entry, errors);
      if (errors.length > before) {
        continue;
      }
      for (const type of rule.elementTypes?.(value) ?? []) {
        if (!elementTypes.has(type)) {
          errors.push(`Rule "${id}" references the element type "${type}", which is not defined.`);
        }
      }
      validated.set(`${id}\0${optionsKey}`, value);
      instances.push({ ruleId: id, rule, optionsKey, options: value });
    }
  }

  if (errors.length) {
    throw new ConfigError('The lanelint config is invalid.', [...new Set(errors)]);
  }

  const memo = new Map<string, ReadonlyMap<string, ResolvedEntry>>();
  const resolvedBase = new Map(
    [...base].map(([id, entry]) => [id, { ...entry, optionsKey: keyOf(entry) }]),
  );
  const entriesAt = (location: ConfigLocation) => {
    const key = `${location.kind}\0${location.path}\0${location.elementType ?? ''}`;
    let entries = memo.get(key);
    if (!entries) {
      const matching = overrides.filter((override) => overrideMatches(override, location));
      if (!matching.length) {
        entries = resolvedBase;
      } else {
        const result = new Map<string, Entry>(base);
        for (const override of matching) {
          for (const [id, entry] of override.rules) {
            result.set(id, apply(result.get(id), entry));
          }
        }
        entries = new Map(
          [...result].map(([id, entry]) => [id, { ...entry, optionsKey: keyOf(entry) }]),
        );
      }
      memo.set(key, entries);
    }
    return entries;
  };

  resolved = {
    root,
    configFile:
      configFile && !configFile.startsWith('..') && !isAbsolute(configFile)
        ? normalize(configFile)
        : undefined,
    include: config.include ?? ['**/*'],
    ignore: config.ignore ?? [],
    gitignore: config.gitignore ?? true,
    tests: config.tests ?? DEFAULT_TESTS,
    failOn: config.failOn ?? 'error',
    elementDefinitions,
    elements,
    plugins: [corePlugin, ...plugins.values()],
    rules,
    base: resolvedBase,
    overrides,
    instances,
    entriesAt,
    levelAt(instance, location) {
      const entry = entriesAt(location).get(instance.ruleId);
      return entry && entry.level !== 'off' && entry.optionsKey === instance.optionsKey
        ? entry.level
        : undefined;
    },
    optionsOf: (ruleId, optionsKey) => validated.get(`${ruleId}\0${optionsKey}`),
  };
  return resolved;
}
