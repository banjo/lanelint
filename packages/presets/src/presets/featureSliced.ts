import { DEFAULT_ENTRIES, defineConfigFragment } from '@lanelint/core';
import boundaries, { type Selector } from '@lanelint/plugin-boundaries';
import { FSD_LAYERS, FSD_SLICED_LAYERS, type FsdLayer } from '../constants/featureSliced.ts';
import { PathUtil } from '../utils/pathUtil.ts';

export interface FeatureSlicedOptions {
  /** The directory that holds the layers. It can have captures, such as `apps/:app/src`. Defaults to `src`. */
  readonly root?: string;
}

const isSliced = (layer: FsdLayer) => FSD_SLICED_LAYERS.includes(layer);

/** Selects the files of some layers, in slices or segments. */
const layers = (names: readonly FsdLayer[]): Selector[] => {
  const sliced = names.filter(isSliced);
  const unsliced = names.filter((name) => !isSliced(name));
  return [
    ...(sliced.length ? [{ type: 'slice', captures: { layer: sliced } }] : []),
    ...(unsliced.length ? [{ type: 'layer', captures: { layer: unsliced } }] : []),
  ];
};

/**
 * Feature-Sliced Design: layers import only layers below them, slices on one layer do not
 * import each other, and slices are used through their index file.
 */
export function featureSliced(options: FeatureSlicedOptions = {}) {
  const root = PathUtil.normalize(options.root ?? 'src');
  const entities = PathUtil.join(PathUtil.toGlob(root), 'entities');

  const layerRules = FSD_LAYERS.slice(1).map((layer, index) => {
    const above = FSD_LAYERS.slice(0, index + 1);
    if (layer === 'entities') {
      // Entities may cross-import each other only through @x files.
      const otherEntities: Selector = {
        type: 'slice',
        captures: { layer: 'entities' },
        files: [`${entities}/*/!(@x)/**`, `${entities}/*/*`],
      };
      return {
        from: layers([layer]),
        disallow: [...layers(above), otherEntities],
        hint: 'Move the code that needs both to a higher layer. Entities may share code with each other through @x files.',
      };
    }
    return {
      from: layers([layer]),
      disallow: layers(isSliced(layer) ? [...above, layer] : above),
      hint: isSliced(layer)
        ? 'Move the shared code down to a lower layer, or compose the slices in a higher layer.'
        : 'Move this code up to the layer that uses it, or pass what it needs in as an argument.',
    };
  });
  const crossImportRule = {
    from: layers(['app', ...FSD_SLICED_LAYERS.filter((layer) => layer !== 'entities')]),
    disallow: { files: `${entities}/*/@x/**` },
    message: 'Only other entities may import @x files.',
    hint: 'Import the entity through its index file.',
  };

  return defineConfigFragment({
    plugins: [boundaries],
    elements: [
      {
        type: 'slice',
        pattern: PathUtil.join(root, ':layer', ':slice'),
        where: { layer: [...FSD_SLICED_LAYERS] },
        entry: [...DEFAULT_ENTRIES, '@x/*'],
        description:
          'A slice: one business domain on a layer. Other slices use it through its index file, and only from higher layers.',
      },
      {
        type: 'layer',
        pattern: PathUtil.join(root, ':layer'),
        where: { layer: ['app', 'shared'] },
        description:
          'The App or Shared layer. It has segments instead of slices, and they may import each other.',
      },
    ],
    rules: {
      'boundaries/allowed-imports': ['error', { rules: [...layerRules, crossImportRule] }],
      'boundaries/entry-only': ['error', { elements: 'slice' }],
      'boundaries/no-entry-import': ['error', { rules: [{ from: 'slice', to: 'self' }] }],
    },
  });
}
