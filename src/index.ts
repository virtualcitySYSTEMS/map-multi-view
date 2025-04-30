import { watch } from 'vue';
import {
  CesiumMap,
  ObliqueMap,
  ObliqueViewDirection,
  VcsEvent,
  type ObliqueImage,
  type VcsMap,
} from '@vcmap/core';
import { VcsPlugin, VcsUiApp } from '@vcmap/ui';
import type { Event } from '@vcmap-cesium/engine';
import { name, version, mapVersion } from '../package.json';
import createMultiViewManager, {
  MultiViewManager,
} from './multiViewManager.js';
import addMultiViewButton from './util/toolboxHelper.js';

type AbstractMultiViewOptions = {
  // map className
  map: string;
};

type ObliqueMultiViewOptions = AbstractMultiViewOptions & {
  // The collection that should be displayed in this view. If null, the oblique collection of the current oblique map is displayed.
  collection: string | null;
  direction: ObliqueViewDirection;
};

/** The multiView internal config, to lay the foundation for later config/state. In version 2 this is more like a state since it can be modified during runtime. */
export type PluginConfig = {
  views: ObliqueMultiViewOptions[];
};

type PluginState = {
  // Whether the plugin is active.
  active?: boolean;
};

export type MultiViewPlugin = VcsPlugin<PluginConfig, PluginState> & {
  multiView: MultiViewManager;
  active: boolean;
  activate(): Promise<void>;
  deactivate(): void;
  stateChanged: VcsEvent<boolean>;
};

export const viewConfig: PluginConfig = {
  views: [
    {
      map: 'ObliqueMap',
      collection: null,
      direction: ObliqueViewDirection.NORTH,
    },
    {
      map: 'ObliqueMap',
      collection: null,
      direction: ObliqueViewDirection.EAST,
    },
    {
      map: 'ObliqueMap',
      collection: null,
      direction: ObliqueViewDirection.SOUTH,
    },
    {
      map: 'ObliqueMap',
      collection: null,
      direction: ObliqueViewDirection.WEST,
    },
  ],
};

function isMapLoaded(map: VcsMap): boolean {
  if (map instanceof CesiumMap) {
    const globe = map.getCesiumWidget()?.scene.globe;
    return !!globe?.tilesLoaded;
  } else if (map instanceof ObliqueMap) {
    return !!map.currentImage;
  } else {
    return true;
  }
}

function getMapLoadedEvent(
  map: VcsMap,
): Event | VcsEvent<ObliqueImage> | undefined {
  if (map instanceof CesiumMap) {
    const globe = map.getCesiumWidget()?.scene.globe;
    if (globe) {
      return globe.tileLoadProgressEvent;
    } else {
      throw new Error('no globe available');
    }
  } else if (map instanceof ObliqueMap) {
    if (map.imageChanged) {
      return map.imageChanged;
    } else {
      throw new Error('no imageChanged event available');
    }
  } else {
    return undefined;
  }
}

async function activateWhenFirstMapLoaded(
  app: VcsUiApp,
  multiViewManager: MultiViewManager,
): Promise<void> {
  const { maps } = app;
  let mapActivatedListener = (): void => {};
  let mapLoadedListener: (() => void) | undefined;

  async function activateWhenMapLoaded(map: VcsMap): Promise<void> {
    mapLoadedListener?.();
    if (isMapLoaded(map)) {
      mapActivatedListener();
      await multiViewManager.activate();
    } else {
      mapLoadedListener = getMapLoadedEvent(map)?.addEventListener(() => {
        if (isMapLoaded(map)) {
          mapActivatedListener();
          mapLoadedListener?.();
          // eslint-disable-next-line no-void
          void multiViewManager.activate();
        }
      });
    }
  }

  mapActivatedListener = maps.mapActivated.addEventListener(
    activateWhenMapLoaded,
  );
  if (maps.activeMap) {
    await activateWhenMapLoaded(maps.activeMap);
  }
}

export default function plugin(): MultiViewPlugin {
  let multiViewManager: MultiViewManager;
  let destroyButton: () => void = () => {};
  let mapAddedListener: () => void = () => {};

  return {
    get name(): string {
      return name;
    },
    get version(): string {
      return version;
    },
    get mapVersion(): string {
      return mapVersion;
    },
    get multiView(): MultiViewManager {
      return multiViewManager;
    },
    get active(): boolean {
      return multiViewManager?.active;
    },
    async activate(): Promise<void> {
      await multiViewManager?.activate();
    },
    deactivate(): void {
      multiViewManager?.deactivate();
    },
    get stateChanged(): VcsEvent<boolean> {
      return multiViewManager.stateChanged;
    },
    async initialize(vcsUiApp: VcsUiApp, state?: PluginState): Promise<void> {
      multiViewManager = createMultiViewManager(vcsUiApp, viewConfig);
      destroyButton = addMultiViewButton(vcsUiApp, multiViewManager, name);
      mapAddedListener = vcsUiApp.maps.added.addEventListener(async (map) => {
        if (map instanceof ObliqueMap) {
          await map.initialize();
        }
      });
      // needs to be initialized, otherwise it might not contain a collection.
      await vcsUiApp.maps.getByType(ObliqueMap.className)[0]?.initialize();
      if (state?.active) {
        if (!multiViewManager.disabled && vcsUiApp.maps.activeMap) {
          await multiViewManager.activate();
        } else {
          const disabledWatcher = watch(
            multiViewManager.disabled,
            async (disabled) => {
              if (!disabled) {
                disabledWatcher();
                await activateWhenFirstMapLoaded(vcsUiApp, multiViewManager);
              }
            },
            { immediate: true },
          );
        }
      }
    },
    getState(): PluginState {
      const active = multiViewManager?.active;

      return {
        ...(active && { active }),
      };
    },
    i18n: {
      en: {
        multiView: {
          title: 'Multiview tool',
          north: 'north',
          east: 'east',
          south: 'south',
          west: 'west',
        },
      },
      de: {
        multiView: {
          title: 'Mehrfachansicht',
          north: 'Norden',
          east: 'Osten',
          south: 'Süden',
          west: 'Westen',
        },
      },
    },
    destroy(): void {
      destroyButton();
      multiViewManager.destroy();
      mapAddedListener();
    },
  };
}
