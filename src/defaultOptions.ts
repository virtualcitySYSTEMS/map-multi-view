import { type MultiViewPluginConfig } from './index.js';

export function getDefaultOptions(): MultiViewPluginConfig {
  return {
    activeOnStartup: false,
    startingSideMap: undefined,
    allowedSideMaps: [],
    obliqueCollectionName: undefined,
  };
}
