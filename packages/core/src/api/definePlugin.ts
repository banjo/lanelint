import type {
  AnyPlugin,
  ConfigFragment,
  PilotlintConfig,
  Plugin,
  TypedConfigFragment,
} from '../models/config.ts';
import type { AnyRule } from '../models/rule.ts';

type Configs = Readonly<Record<string, Omit<ConfigFragment, 'plugins'>>>;

interface PluginDefinition<
  Name extends string,
  Rules extends Readonly<Record<string, AnyRule>>,
  PluginConfigs extends Configs,
> {
  readonly name: Name;
  readonly description?: string;
  readonly rules: Rules;
  readonly configs?: PluginConfigs;
}

/** Creates a plugin. Its configs register the plugin when used in `extends`. */
export function definePlugin<
  const Name extends string,
  const Rules extends Readonly<Record<string, AnyRule>>,
  const PluginConfigs extends Configs = Record<never, never>,
>(
  definition: PluginDefinition<Name, Rules, PluginConfigs>,
): Plugin<Name, Rules, keyof PluginConfigs & string> {
  type Self = Plugin<Name, Rules, keyof PluginConfigs & string>;
  const configs: Record<string, ConfigFragment<readonly [Self]>> = {};
  const plugin: Self = {
    name: definition.name,
    description: definition.description,
    rules: definition.rules,
    configs: configs as Record<keyof PluginConfigs & string, ConfigFragment<readonly [Self]>>,
  };
  for (const [name, config] of Object.entries(definition.configs ?? {})) {
    configs[name] = { ...config, plugins: [plugin] };
  }
  return plugin;
}

/** Typed pilotlint config. Rule ids and options are checked against `plugins` and `extends`. */
export function defineConfig<
  const Plugins extends readonly AnyPlugin[] = readonly [],
  const Extends extends readonly ConfigFragment[] = readonly [],
>(config: PilotlintConfig<Plugins, Extends>): PilotlintConfig<Plugins, Extends> {
  return config;
}

/** Typed shareable config, for packages that publish configs without rules. */
export function defineConfigFragment<const Plugins extends readonly AnyPlugin[] = readonly []>(
  fragment: TypedConfigFragment<Plugins>,
): ConfigFragment<Plugins> {
  return fragment;
}
