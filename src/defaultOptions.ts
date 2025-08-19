import { OpenlayersMap, CesiumMap, PanoramaMap, ObliqueMap } from '@vcmap/core';
import { type MultiViewPluginConfig } from './index.js';
import ObliqueMultiView from './obliqueMultiView.js';

export function getDefaultOptions(): MultiViewPluginConfig {
  return {
    activeOnStartup: false,
    startingSideMap: undefined,
    allowedSideMaps: [
      OpenlayersMap.className,
      CesiumMap.className,
      PanoramaMap.className,
      ObliqueMap.className,
      ObliqueMultiView.className,
    ],
    obliqueCollectionName: undefined,
  };
}
