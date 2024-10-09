import { ObliqueMap, ObliqueViewDirection, VcsEvent } from '@vcmap/core';
import { VcsPlugin, VcsUiApp } from '@vcmap/ui';
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
        await multiViewManager.activate();
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
          activate: 'Enable Multi View',
          deactivate: 'Disable Multi View',
          north: 'north',
          east: 'east',
          south: 'south',
          west: 'west',
        },
      },
      de: {
        multiView: {
          activate: 'Mehrfachansicht aktivieren',
          deactivate: 'Mehrfachansicht deaktivieren',
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
