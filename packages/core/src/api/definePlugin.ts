import type { AnyPlugin, PilotlintConfig, ConfigFragment, Plugin } from '../models/config.ts';
import type { AnyRule } from '../models/rule.ts';

type Configs = Readonly<Record<string, Omit<ConfigFragment, 'plugins'>>>;

interface PluginDefinition<
  Name extends string,
  Rules extends Readonly<Record<string, AnyRule>>,
  PluginConfigs extends Configs,
> {
  readonly name: Name;
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
  const configs: Record<string, ConfigFragment> = {};
  const plugin: Plugin<Name, Rules, keyof PluginConfigs & string> = {
    name: definition.name,
    rules: definition.rules,
    configs: configs as Record<keyof PluginConfigs & string, ConfigFragment>,
  };
  for (const [name, config] of Object.entries(definition.configs ?? {})) {
    configs[name] = { ...config, plugins: [plugin] };
  }
  return plugin;
}

/** Typed pilotlint config. Rule ids and options are checked against `plugins`. */
export function defineConfig<const Plugins extends readonly AnyPlugin[] = readonly []>(
  config: PilotlintConfig<Plugins>,
): PilotlintConfig<Plugins> {
  return config;
}

/** Typed shareable config, for packages that publish configs without rules. */
export function defineConfigFragment(fragment: ConfigFragment): ConfigFragment {
  return fragment;
}
