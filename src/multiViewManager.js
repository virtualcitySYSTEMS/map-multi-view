import { computed, ref, shallowRef, watch } from 'vue';
import {
  ObliqueMap,
  OpenlayersMap,
  VcsEvent,
  Viewpoint,
  getDirectionName,
  getHeightFromTerrainProvider,
} from '@vcmap/core';
import { setColumnRight } from './util/layoutHelper.js';
import {
  mountMultiViewComponent,
  handleJumpToViewpoint,
} from './util/componentHelper.js';

/**
 * @typedef {Object} MultiViewManager
 * @property {function():Promise<void>} activate Activates the multi view.
 * @property {function():void} deactivate Deactivates the multi view.
 * @property {boolean} active If multi view is currently active.
 * @property {Map<number, import("@vcmap/core").VcsMap>} views A map with view id as keys and values the map instances.
 * @property {import("@vcmap/core").VcsEvent<boolean>} stateChanged Event that raises if the active state changes.
 * @property {import("vue").ComputedRef<boolean>} disabled Whether the multi view is disabled due to missing
 * @property {function():void} destroy
 */

/**
 * Enriches the groundPosition of a Viewpoint with the height from a oblique terrain provider.
 * @param {import("@vcmap/core").ObliqueMap} obliqueMap The oblique map which terrain provide is used to determine the height.
 * @param {import("@vcmap/core").Viewpoint} viewpoint The viewpoint which should be enriched with a z ground coordinate
 */
async function setHeightFromOblique(obliqueMap, viewpoint) {
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
 * @param {import("@vcmap/core").VcsApp} app
 * @param {import("vue").ShallowRef<import("@vcmap/core").ObliqueCollection | undefined>} defaultCollection
 * @returns {function():void} remove callback for the oblique listeners.
 */
function setDefaultObliqueCollection(app, defaultCollection) {
  let collectionChangedListener;
  /** @type {import("@vcmap/core").ObliqueMap | undefined} */
  let currentMap;
  /**
   * Sets the defaultCollection and updates on collectionChanged events of the passed map.
   * @param {import("@vcmap/core").ObliqueMap | undefined} map The source oblique map for the default oblique collection.
   * @returns {function():void} Remove callback for the collectionChanged listener.
   */
  function handleObliqueCollectionChanges(map) {
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
  function setFirstObliqueMap() {
    const obliqueMap =
      /** @type {import("@vcmap/core").ObliqueMap | undefined} */ (
        app.maps.getByType(ObliqueMap.className)[0]
      );
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
 * @param {import("@vcmap/core").VcsApp} app The VcsUiApp instance
 * @param {import('./index').MultiViewConfig} viewConfig The multi view config which defines the different views and the layout.
 * @returns {MultiViewManager} The api of the multi view manager.
 */
export default function createMultiViewManager(app, viewConfig) {
  /** Whether the multi view is currently active */
  let isActive = false;
  /** Whether there is currently updateView() running. */
  let updateRunning = false;

  /** @type {Map<number, import("@vcmap/core").VcsMap>} */
  const views = new Map();
  /**
   * The active view, which is calculated from the viewpoints heading and the ObliqueDirection of the view.
   * @type {import("vue").Ref<number | undefined>}
   */
  const activeView = ref();

  /**
   * Triggers the updateView on postRender event of the activeMap
   * @type {function():void | undefined}
   */
  let postRenderListener = () => {};
  let mapChangedListener = () => {};

  /** Removes the multi view panel and resets the main map to full size. */
  let resetLayout = () => {};
  let destroyMultiViewComponent = () => {};
  /** Event that is raised when there is a change to the active state. */
  const stateChanged = new VcsEvent();

  /**
   * The default oblique collection is the collection that is set on the oblique map that is on index 0 when getting oblique maps by type. If an oblique map is added later, the collection of this map is the default. If this map is removed, the default jumps back to the first in the oblique maps array.
   * @type {import("vue").ShallowRef<import("@vcmap/core").ObliqueCollection | undefined>}
   */
  const defaultObliqueCollection = shallowRef();
  /**
   * Reacts to changes of the defaultObliqueCollection and updates all views that show the default oblique collection.
   * @type {import("vue").WatchStopHandle | undefined}
   */
  let defaultObliqueCollectionWatcher;

  const removeObliqueListeners = setDefaultObliqueCollection(
    app,
    defaultObliqueCollection,
  );

  const disabled = computed(() => !defaultObliqueCollection.value);

  /**
   * Creates oblique maps with initial viewpoint and sets them on the views Map object.
   * @param {number} key The index of the map in the views config array. This is set as key in the views map.
   * @param {import("@vcmap/core").Viewpoint} viewpoint The initial viewpoint for the oblique view.
   */
  async function setupObliqueMap(key, viewpoint) {
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
      map.setCollection(defaultObliqueCollection.value, viewpoint);
    } else {
      throw new Error('map contains no oblique collection');
    }
    await map.initialize();
  }

  /**
   * Updates the viewpoint of all the views. Also sets the active view.
   * @returns {Promise<void>}
   */
  async function updateView() {
    const { activeMap } = app.maps;
    if (!updateRunning && activeMap) {
      updateRunning = true;
      /** The index of the active view. Undefined if there is no active view. */
      let newActiveView;
      const currentViewpoint = await activeMap.getViewpoint();
      if (currentViewpoint) {
        // To avoid sending a request to the terrain for every view when the Z coordinate is missing (if activeMap is 2D map)
        if (!currentViewpoint.groundPosition?.[2]) {
          const obliqueMap = /** @type {import("@vcmap/core").ObliqueMap} */ (
            [...views.values()].find(
              (map) => map.className === ObliqueMap.className,
            )
          );
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
          await map.gotoViewpoint(newViewpoint);
        });
        await Promise.all(promises);
      }
      activeView.value = newActiveView;
      updateRunning = false;
    }
  }

  /**
   * Deactivates the multi view.
   */
  function deactivate() {
    if (isActive) {
      postRenderListener?.();
      mapChangedListener();

      Array.from(views.values()).forEach((map) => {
        map.destroy();
      });
      updateRunning = false;
      views.clear();

      defaultObliqueCollectionWatcher?.();
      resetLayout();
      destroyMultiViewComponent();

      isActive = false;
      stateChanged.raiseEvent(isActive);
    }
  }

  /**
   * Activates the multi view.
   */
  async function activate() {
    if (!isActive && !disabled.value) {
      const { activeMap } = app.maps;
      const viewpoint = await activeMap?.getViewpoint();

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
          throw new Error(`The follwing map is not supported: ${options.map}`); // validation should happen when parsing the config
        }
      }

      await Promise.all(obliquePromises);

      postRenderListener = activeMap?.postRender.addEventListener(updateView);
      mapChangedListener = app.maps.mapActivated.addEventListener((map) => {
        postRenderListener?.();
        postRenderListener = map.postRender.addEventListener(updateView);
      });

      resetLayout = setColumnRight();

      destroyMultiViewComponent = mountMultiViewComponent(
        app.vueI18n,
        viewTitles,
        activeView,
        (index) => handleJumpToViewpoint(app, views, index),
      );

      const activatePromises = [...views].map(async ([key, map]) => {
        await map.activate();
        map.setTarget(`multi-view-map-${key}`);
      });

      await Promise.all(activatePromises);

      defaultObliqueCollectionWatcher = watch(
        defaultObliqueCollection,
        (newCollection) => {
          if (newCollection) {
            viewConfig.views.forEach((view, index) => {
              if (
                view.map === ObliqueMap.className &&
                view.collection === null
              ) {
                /** @type {import("@vcmap/core").ObliqueMap} */ (
                  views.get(index)
                )?.setCollection(newCollection);
              }
            });
          } else {
            deactivate();
          }
        },
      );

      isActive = true;
      stateChanged.raiseEvent(isActive);
    }
  }

  return {
    activate,
    deactivate,
    destroy() {
      deactivate();
      stateChanged.destroy();
      removeObliqueListeners();
    },
    get active() {
      return isActive;
    },
    views,
    stateChanged,
    disabled,
  };
}
