/** Feature-Sliced Design layers, from the top (most dependencies) to the bottom. */
export const FSD_LAYERS = [
  'app',
  'processes',
  'pages',
  'widgets',
  'features',
  'entities',
  'shared',
] as const;

export type FsdLayer = (typeof FSD_LAYERS)[number];

/** Layers that are split into slices. App and Shared are made of segments instead. */
export const FSD_SLICED_LAYERS: readonly FsdLayer[] = [
  'processes',
  'pages',
  'widgets',
  'features',
  'entities',
];
