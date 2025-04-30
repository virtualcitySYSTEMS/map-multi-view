import {
  computed,
  ComputedRef,
  Ref,
  ref,
  ShallowRef,
  shallowRef,
  watch,
  WatchStopHandle,
} from 'vue';
import {
  CesiumMap,
  ObliqueCollection,
  ObliqueMap,
  OpenlayersMap,
  VcsEvent,
  VcsMap,
  Viewpoint,
  VisualisationType,
  getDirectionName,
  getHeightFromTerrainProvider,
} from '@vcmap/core';
import { PanelLocation, VcsUiApp } from '@vcmap/ui';
import MultiViewGrid from './MultiViewGrid.vue';
import { name } from '../package.json';
import { PluginConfig } from './index.js';

export type MultiViewManager = {
  activate: () => Promise<void>;
  deactivate: () => void;
  active: boolean;
  // A map with view id as keys and values the map instances.
  views: Map<number, VcsMap>;
  activeView: Ref<number | undefined>;
  stateChanged: VcsEvent<boolean>;
  disabled: ComputedRef<boolean>;
  destroy: () => void;
};

/**
 * Enriches the groundPosition of a Viewpoint with the height from a oblique terrain provider.
 * @param obliqueMap The oblique map which terrain provide is used to determine the height.
 * @param viewpoint The viewpoint which should be enriched with a z ground coordinate
 */
async function setHeightFromOblique(
  obliqueMap: ObliqueMap,
  viewpoint: Viewpoint,
): Promise<void> {
  const terrainProvider = obliqueMap.currentImage?.meta?.terrainProvider;
  if (terrainProvider) {
    if (viewpoint.groundPosition) {
      await getHeightFromTerrainProvider(
        terrainProvider,
        [viewpoint.groundPosition],
        undefined,
        [viewpoint.groundPosition],
      );
    }
  }
}

/**
 * Sets the default collection and adds all the necessary listeners to the maps collection and the oblique map so the defaultOblique collection is always updated.
 * @returns remove callback for the oblique listeners.
 */
function setDefaultObliqueCollection(
  app: VcsUiApp,
  defaultCollection: Ref<ObliqueCollection | undefined>,
): () => void {
  let collectionChangedListener: () => void;
  let currentMap: ObliqueMap | undefined;
  /**
   * Sets the defaultCollection and updates on collectionChanged events of the passed map.
   * @param  map The source oblique map for the default oblique collection.
   * @returns Remove callback for the collectionChanged listener.
   */
  function handleObliqueCollectionChanges(map?: ObliqueMap): () => void {
    if (map) {
      currentMap = map;
      defaultCollection.value = map.collection || undefined;
      return map.collectionChanged.addEventListener((collection) => {
        defaultCollection.value = collection;
      });
    } else {
      defaultCollection.value = undefined;
      currentMap = undefined;
      return () => {};
    }
  }
  /**
   * Sets the first oblique map of the maps collection as the source for the default collection.
   */
  function setFirstObliqueMap(): void {
    const obliqueMap = app.maps.getByType(ObliqueMap.className)[0] as
      | ObliqueMap
      | undefined;
    collectionChangedListener = handleObliqueCollectionChanges(obliqueMap);
  }

  setFirstObliqueMap();

  const mapAddedListener = app.maps.added.addEventListener((map) => {
    if (map instanceof ObliqueMap) {
      collectionChangedListener?.();
      collectionChangedListener = handleObliqueCollectionChanges(map);
    }
  });

  const mapRemovedListener = app.maps.removed.addEventListener((map) => {
    if (map.name === currentMap?.name) {
      collectionChangedListener?.();
      setFirstObliqueMap();
    }
  });

  return () => {
    mapAddedListener();
    mapRemovedListener();
    collectionChangedListener?.();
  };
}

/**
 * Creates the multi-view manager, which is responsable for:
 * - adding the multi-view panel and changing the main vcs maps size
 * - setting up the maps for the views
 * - ensuring the synchronization between the main map and the views
 * @param app The VcsUiApp instance
 * @param viewConfig The multi view config which defines the different views and the layout.
 * @returns The api of the multi view manager.
 */
export default function createMultiViewManager(
  app: VcsUiApp,
  viewConfig: PluginConfig,
): MultiViewManager {
  /** Whether the multi view is currently active */
  let isActive = false;
  /** Whether there is currently updateView() running. */
  let updateRunning = false;

  const views: Map<number, VcsMap> = new Map();
  /**
   * The active view, which is calculated from the viewpoints heading and the ObliqueDirection of the view.
   */
  const activeView: Ref<number | undefined> = ref();

  /**
   * Triggers the updateView on postRender event of the activeMap
   */
  let postRenderListener: (() => void) | undefined = () => {};
  let mapChangedListener: () => void = () => {};

  /** Event that is raised when there is a change to the active state. */
  const stateChanged = new VcsEvent<boolean>();

  /**
   * The default oblique collection is the collection that is set on the oblique map that is on index 0 when getting oblique maps by type. If an oblique map is added later, the collection of this map is the default. If this map is removed, the default jumps back to the first in the oblique maps array.
   */
  const defaultObliqueCollection: ShallowRef<ObliqueCollection | undefined> =
    shallowRef();
  /**
   * Reacts to changes of the defaultObliqueCollection and updates all views that show the default oblique collection.
   */
  let defaultObliqueCollectionWatcher: WatchStopHandle;

  const removeObliqueListeners = setDefaultObliqueCollection(
    app,
    defaultObliqueCollection,
  );

  const disabled = computed(() => !defaultObliqueCollection.value);

  /**
   * Creates oblique maps with initial viewpoint and sets them on the views Map object.
   * @param key The index of the map in the views config array. This is set as key in the views map.
   * @param viewpoint The initial viewpoint for the oblique view.
   */
  async function setupObliqueMap(
    key: number,
    viewpoint: Viewpoint,
  ): Promise<void> {
    const map = new ObliqueMap({ switchOnEdge: false });
    views.set(key, map);
    if (viewConfig.views[key].collection) {
      const collection = app.obliqueCollections.getByKey(
        viewConfig.views[key].collection,
      );
      if (collection) {
        await map.setCollection(collection, viewpoint);
      } else {
        throw new Error(
          `oblique collection: ${viewConfig.views[key].collection} does not exist`,
        );
      }
    } else if (defaultObliqueCollection.value) {
      await map.setCollection(defaultObliqueCollection.value, viewpoint);
    } else {
      throw new Error('map contains no oblique collection');
    }
    await map.initialize();
  }

  /**
   * Updates the viewpoint of all the views. Also sets the active view.
   */
  async function updateView(): Promise<void> {
    const { activeMap } = app.maps;
    if (!updateRunning && activeMap) {
      updateRunning = true;
      /** The index of the active view. Undefined if there is no active view. */
      let newActiveView;
      const currentViewpoint = await activeMap.getViewpoint();
      if (currentViewpoint) {
        // To avoid sending a request to the terrain for every view when the Z coordinate is missing (if activeMap is 2D map)
        if (!currentViewpoint.groundPosition?.[2]) {
          const obliqueMap = [...views.values()].find(
            (map) => map.className === ObliqueMap.className,
          ) as ObliqueMap;
          // check if there is an obliqueMap in the views to get the terrain from.
          if (obliqueMap) {
            await setHeightFromOblique(obliqueMap, currentViewpoint);
          }
        }
        const currentObliqueDirection =
          (Math.round(currentViewpoint.heading / 90) % 4) + 1;
        // go through all views to set new viewpoint on corresponding map.
        const promises = [...views].map(async ([key, map]) => {
          let newViewpoint;
          if (map.className === ObliqueMap.className) {
            newViewpoint = new Viewpoint({
              groundPosition: currentViewpoint.groundPosition || undefined,
              distance: currentViewpoint.distance,
              heading: (viewConfig.views[key].direction - 1) * 90,
            });
            // only oblique map can be an active view
            if (
              activeMap.className !== OpenlayersMap.className &&
              currentObliqueDirection === viewConfig.views[key].direction
            ) {
              newActiveView = Number(key);
            }
          }
          if (newViewpoint) {
            await map.gotoViewpoint(newViewpoint);
          }
        });
        await Promise.all(promises);
      }
      activeView.value = newActiveView;
      updateRunning = false;
    }
  }

  function setPostRenderListener(map?: VcsMap<VisualisationType> | null): void {
    postRenderListener?.();
    if (map instanceof CesiumMap) {
      const camera = map.getCesiumWidget()?.camera;
      if (camera) {
        const prevPercentageChanged = camera?.percentageChanged;
        camera.percentageChanged = 0.001;
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        const changedListener = camera.changed.addEventListener(updateView);
        postRenderListener = (): void => {
          changedListener();
          camera.percentageChanged = prevPercentageChanged;
        };
      } else {
        postRenderListener = undefined;
      }
    } else {
      postRenderListener = map?.postRender.addEventListener(updateView);
    }
  }

  /**
   * Deactivates the multi view.
   */
  function deactivate(): void {
    if (isActive) {
      postRenderListener?.();
      mapChangedListener();

      Array.from(views.values()).forEach((map) => {
        map.destroy();
      });
      updateRunning = false;
      views.clear();

      defaultObliqueCollectionWatcher?.();
      app.panelManager.removeOwner(name);

      isActive = false;
      stateChanged.raiseEvent(isActive);
    }
  }

  /**
   * Activates the multi view.
   */
  async function activate(): Promise<void> {
    if (!isActive && !disabled.value) {
      const { activeMap } = app.maps;
      const viewpoint = await activeMap?.getViewpoint();
      if (!viewpoint) {
        throw new Error('No viewpoint available.');
      }

      /** The titles to be shown in the upper left corner of each view. */
      const viewTitles = [];
      const obliquePromises = [];

      // setting up all the maps for the views.
      for (let index = 0; index < viewConfig.views.length; index++) {
        const options = viewConfig.views[index];
        if (options.map === 'ObliqueMap') {
          obliquePromises.push(setupObliqueMap(index, viewpoint));
          viewTitles.push(`multiView.${getDirectionName(options.direction)}`);
        } else {
          throw new Error(`The following map is not supported: ${options.map}`); // validation should happen when parsing the config
        }
      }

      await Promise.all(obliquePromises);

      setPostRenderListener(activeMap);
      mapChangedListener = app.maps.mapActivated.addEventListener((map) => {
        setPostRenderListener(map);
      });
      await updateView();

      app.panelManager.add(
        {
          id: name,
          component: MultiViewGrid,
          props: {
            viewTitles,
            activeView,
          },
        },
        name,
        PanelLocation.RIGHT,
      );

      const activatePromises = [...views].map(async ([key, map]) => {
        await map.activate();
        map.setTarget(`multi-view-map-${key}`);
      });

      await Promise.all(activatePromises);

      defaultObliqueCollectionWatcher = watch(
        defaultObliqueCollection,
        async (newCollection) => {
          if (newCollection) {
            await Promise.all(
              viewConfig.views.map(async (view, index) => {
                if (
                  view.map === ObliqueMap.className &&
                  view.collection === null
                ) {
                  await (views.get(index) as ObliqueMap).setCollection(
                    newCollection,
                  );
                }
              }),
            );
          } else {
            deactivate();
          }
        },
      );

      isActive = true;
      stateChanged.raiseEvent(isActive);
    }
  }

  // makes sure that plugin is deactivated if panel is removed by other plugin
  const removePanelRemovedListener = app.panelManager.removed.addEventListener(
    ({ id }) => {
      if (id === name) {
        deactivate();
      }
    },
  );

  return {
    activate,
    deactivate,
    destroy(): void {
      deactivate();
      stateChanged.destroy();
      removeObliqueListeners();
      removePanelRemovedListener();
    },
    get active(): boolean {
      return isActive;
    },
    views,
    activeView,
    stateChanged,
    disabled,
  };
}
