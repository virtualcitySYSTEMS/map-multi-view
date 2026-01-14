import {
  CesiumMap,
  EventHandler,
  ObliqueMap,
  OpenlayersMap,
  PanoramaMap,
  type VcsMap,
  PanoramaFeatureHighlight,
  type ObliqueCollection,
  type Viewpoint,
  PanoramaDatasetLayer,
} from '@vcmap/core';
import { type VcsUiApp } from '@vcmap/ui';
import { type Ref, ref, shallowRef } from 'vue';
import MainViewChangedEvent from './mainViewChangedEvent.js';
import MultiViewPanoramaInteraction from './multiViewPanoramaInteraction.js';
import ObliqueMultiView from './obliqueMultiView.js';
import { name as pluginName } from '../package.json';
import { type MultiViewPluginConfig } from './index.js';

export type AllowedMapType = VcsMap | ObliqueMultiView;

export type MultiViewHandler = {
  availableSideMapClasses: Ref<string[]>;
  activeSideMap: Ref<AllowedMapType | null>;
  currentMainMapViewpoint: Ref<Viewpoint | null>;
  isSync: Ref<boolean>;
  setActiveSideMap(newMapClass: string | null): Promise<void>;
  initializeMultiViewMaps(): Promise<void>;
  toggleSync(): Promise<void>;
  switchMaps(): Promise<void>;
  destroy(): void;
};

function setupMultiViewPanoramaInteraction(
  app: VcsUiApp,
  sideMapEventHandler: EventHandler,
  activeSideMap: Ref<AllowedMapType | null>,
  setActiveSideMap: (newMapClass: string) => Promise<void>,
): () => void {
  const overviewMapMultiviewPanoramaInteraction =
    new MultiViewPanoramaInteraction(
      app,
      activeSideMap,
      setActiveSideMap,
      'overviewMap',
    );
  const removeMultiviewPanoramaInteractionFromOverviewMap =
    app.overviewMap.eventHandler.addPersistentInteraction(
      overviewMapMultiviewPanoramaInteraction,
    );
  const overviewMapPanoramaImageSelectionOriginalState =
    app.overviewMap.panoramaImageSelection.active;
  app.overviewMap.panoramaImageSelection.setActive(false);

  const mainMapMultiviewPanoramaInteraction = new MultiViewPanoramaInteraction(
    app,
    activeSideMap,
    setActiveSideMap,
    'mainMap',
  );
  const removeMultiviewPanoramaInteractionFromMainMap =
    app.maps.eventHandler.addPersistentInteraction(
      mainMapMultiviewPanoramaInteraction,
    );
  const mainMapPanoramaImageSelectionOriginalState =
    app.maps.panoramaImageSelection.active;
  app.maps.panoramaImageSelection.setActive(false);

  const sideMapMultiviewPanoramaInteraction = new MultiViewPanoramaInteraction(
    app,
    activeSideMap,
    setActiveSideMap,
    'sideMap',
  );

  const removePanoramaInteractionFromSideMap =
    sideMapEventHandler.addPersistentInteraction(
      sideMapMultiviewPanoramaInteraction,
    );

  return () => {
    removeMultiviewPanoramaInteractionFromOverviewMap();
    app.overviewMap.panoramaImageSelection.setActive(
      overviewMapPanoramaImageSelectionOriginalState,
    );
    overviewMapMultiviewPanoramaInteraction.destroy();

    removeMultiviewPanoramaInteractionFromMainMap();
    app.maps.panoramaImageSelection.setActive(
      mainMapPanoramaImageSelectionOriginalState,
    );
    mainMapMultiviewPanoramaInteraction.destroy();

    removePanoramaInteractionFromSideMap();
    sideMapMultiviewPanoramaInteraction.destroy();
  };
}

export function setupAvailableMainMaps(app: VcsUiApp): {
  availableMainMapClasses: Ref<string[]>;
  activeMainMapClassName: Ref<string | undefined>;
  destroy: () => void;
} {
  const availableMainMapClasses: Ref<string[]> = ref([]);
  const activeMainMapClassName: Ref<string | undefined> = ref(
    app.maps.activeMap?.className,
  );
  const updateAvailableMainMaps = (): void => {
    const mapClasses = new Set<string>();
    [...app.maps].forEach((map) => {
      mapClasses.add(map.className);
    });
    availableMainMapClasses.value = [...mapClasses];
  };
  updateAvailableMainMaps();
  const listeners = [
    app.maps.mapActivated.addEventListener((map) => {
      activeMainMapClassName.value = map?.className;
    }),
    app.maps.added.addEventListener(updateAvailableMainMaps),
    app.maps.removed.addEventListener(updateAvailableMainMaps),
  ];

  return {
    availableMainMapClasses,
    activeMainMapClassName,
    destroy(): void {
      listeners.forEach((cb) => {
        cb();
      });
    },
  };
}

export function createMultiViewHandler(
  app: VcsUiApp,
  config: MultiViewPluginConfig,
): MultiViewHandler {
  const availableSideMapClasses: Ref<string[]> = ref([]);

  const activeSideMap: Ref<AllowedMapType | null> = shallowRef(null);
  const currentMainMapViewpoint: Ref<Viewpoint | null> = shallowRef(null);

  const isSync = ref(true);
  let viewIsChanging = false;

  const sideMapEventHandler = new EventHandler();

  const sideMapPanoramaHighlight = new PanoramaFeatureHighlight();
  sideMapEventHandler.addPersistentInteraction(sideMapPanoramaHighlight);

  const sideMapCache = new Map<string, AllowedMapType>();

  let removeObliqueCollectionChangedListener: (() => void) | null = null;

  async function updateObliqueSideMapCollections(
    collection: ObliqueCollection,
  ): Promise<void> {
    const obliqueSideMaps = [...sideMapCache.values()].filter(
      (map): map is ObliqueMap | ObliqueMultiView =>
        map instanceof ObliqueMultiView,
    );
    await Promise.all(
      obliqueSideMaps.map((map) => map.setCollection(collection)),
    );
  }

  function updateObliqueCollectionChangedListener(map: VcsMap | null): void {
    removeObliqueCollectionChangedListener?.();
    removeObliqueCollectionChangedListener = null;

    if (map instanceof ObliqueMap) {
      const removeListener = map.collectionChanged.addEventListener(
        (collection) => {
          updateObliqueSideMapCollections(collection).catch(() => {});
        },
      );
      removeObliqueCollectionChangedListener = removeListener;

      if (map.collection) {
        updateObliqueSideMapCollections(map.collection).catch(() => {});
      }
    }
  }

  /**
   * Synchronizes the viewpoint from the active map to the multi-view map instance.
   *
   * This asynchronous function handles the core viewpoint synchronization logic between
   * different map types. It extracts the current viewpoint from the active map and applies
   * it to the multi-view map instance, ensuring that navigation changes in one map are
   * reflected in the synchronized view.
   */
  async function changeView(): Promise<void> {
    const activeMainMap = app.maps.activeMap;
    if (
      !activeMainMap ||
      viewIsChanging ||
      (activeMainMap instanceof PanoramaMap &&
        !activeMainMap.currentPanoramaImage)
    ) {
      return;
    }

    const viewpoint = activeMainMap.getViewpointSync();

    if (viewpoint?.isValid() && activeSideMap) {
      if (
        activeSideMap.value instanceof PanoramaMap &&
        app.maps.activeMap instanceof CesiumMap
      ) {
        // remove ground position for panorama maps so we synchronize the camera position
        viewpoint.groundPosition = null;
      }
      viewIsChanging = true;
      await activeSideMap.value?.gotoViewpoint(viewpoint);
      currentMainMapViewpoint.value = viewpoint;
    }
    viewIsChanging = false;
  }

  async function toggleSync(): Promise<void> {
    isSync.value = !isSync.value;
    if (isSync.value) {
      await changeView();
    }
  }

  /**
   * copy Map options from the app so we have the same settings, for example Cesium Globe Color
   * @param mapClassName
   */
  function getMapOptionsFromApp(mapClassName: string): Record<string, unknown> {
    const map = app.maps.getByType(mapClassName)[0];
    if (map) {
      const options = map.toJSON();
      options.name = `${mapClassName}-multi-view`;
      return options;
    }
    return {};
  }

  function getObliqueCollection(): ObliqueCollection | undefined {
    let collection: ObliqueCollection | undefined | null;
    if (config.obliqueCollectionName) {
      collection = app.obliqueCollections.getByKey(
        config.obliqueCollectionName,
      );
    }
    if (!collection) {
      // find initialized oblique Map, take collection from there.
      const initializedObliqueMap = app.maps
        .getByType(ObliqueMap.className)
        .find((map) => map.initialized);
      if (
        initializedObliqueMap &&
        initializedObliqueMap instanceof ObliqueMap
      ) {
        collection = initializedObliqueMap.collection;
      }
    }
    if (!collection) {
      // find the configured startingObliqueCollection
      const startingObliqueCollectionName = [...app.modules]
        .reverse()
        .map((module) => module.startingObliqueCollectionName)
        .find((name) => name);
      collection = app.obliqueCollections.getByKey(
        startingObliqueCollectionName,
      );
    }
    // return the first or undefined;
    return collection ?? [...app.obliqueCollections][0];
  }

  async function syncCachedMapWithCurrentCollection(
    cachedMap: AllowedMapType,
  ): Promise<void> {
    // Only sync if main map is oblique and no explicit collection was configured
    if (
      !(app.maps.activeMap instanceof ObliqueMap) ||
      config.obliqueCollectionName
    ) {
      return;
    }

    const mainMapCollection = app.maps.activeMap.collection;
    if (!mainMapCollection) {
      return;
    }

    if (
      cachedMap instanceof ObliqueMap &&
      cachedMap.collection !== mainMapCollection
    ) {
      await cachedMap.setCollection(mainMapCollection);
    } else if (cachedMap instanceof ObliqueMultiView) {
      await cachedMap.setCollection(mainMapCollection);
    }
  }

  async function getSideMap(
    newMapClass: string,
  ): Promise<AllowedMapType | null> {
    if (sideMapCache.has(newMapClass)) {
      const cachedMap = sideMapCache.get(newMapClass)!;
      await syncCachedMapWithCurrentCollection(cachedMap);
      return cachedMap;
    }
    let multiMapInstance = null;
    if (newMapClass === OpenlayersMap.className) {
      multiMapInstance = new OpenlayersMap(getMapOptionsFromApp(newMapClass));
    } else if (newMapClass === CesiumMap.className) {
      multiMapInstance = new CesiumMap(getMapOptionsFromApp(newMapClass));
    } else if (newMapClass === PanoramaMap.className) {
      multiMapInstance = new PanoramaMap(getMapOptionsFromApp(newMapClass));
    } else if (newMapClass === ObliqueMap.className) {
      const obliqueCollection = getObliqueCollection();
      if (obliqueCollection) {
        multiMapInstance = new ObliqueMap(getMapOptionsFromApp(newMapClass));
        await multiMapInstance.setCollection(obliqueCollection);
      }
    } else if (newMapClass === ObliqueMultiView.className) {
      const obliqueCollection = getObliqueCollection();
      if (obliqueCollection) {
        multiMapInstance = new ObliqueMultiView();
        await multiMapInstance.setCollection(obliqueCollection);
      }
    }

    if (multiMapInstance) {
      // Pipe pointer events of all side maps to panoramaSideMapEventHandler
      multiMapInstance.pointerInteractionEvent.addEventListener((event) => {
        sideMapEventHandler.handleMapEvent(event);
      });
      multiMapInstance.setTarget('multi-view-map-container');
      multiMapInstance.layerCollection = app.maps.layerCollection;
      sideMapCache.set(newMapClass, multiMapInstance);
    }
    return multiMapInstance;
  }

  async function setActiveSideMap(newMapClass: string): Promise<void> {
    if (newMapClass === activeSideMap.value?.className) {
      return;
    }
    const map = await getSideMap(newMapClass);
    if (map) {
      activeSideMap.value?.deactivate();
      await map.activate();
      activeSideMap.value = map;
      await changeView();

      if (map instanceof PanoramaMap) {
        isSync.value = false; // Disable sync for panorama maps
      }
    }
  }

  const destroyMultiviewPanoramaInteraction = setupMultiViewPanoramaInteraction(
    app,
    sideMapEventHandler,
    activeSideMap,
    setActiveSideMap,
  );

  async function switchMaps(): Promise<void> {
    const newMainMapName = app.maps.getByType(
      activeSideMap.value?.className ?? '',
    )[0]?.name;
    viewIsChanging = true;
    const newSideMapClassName = app.maps.activeMap?.className;
    if (newMainMapName) {
      await app.maps.setActiveMap(newMainMapName);
    }
    if (newSideMapClassName) {
      await setActiveSideMap(newSideMapClassName);
    }
    viewIsChanging = false;
    await changeView();
  }

  /**
   * Initialize the view changed events.
   */
  const mainViewChangedEvent = new MainViewChangedEvent();
  mainViewChangedEvent.setActiveMap(app.maps.activeMap);
  updateObliqueCollectionChangedListener(app.maps.activeMap);
  mainViewChangedEvent.addEventListener(async () => {
    if (activeSideMap.value && isSync.value) {
      await changeView();
    }
  });

  /**
   * Initialize multi-view maps for all existing maps in the application.
   *
   * Iterates through all maps currently present in the app.maps collection
   * and creates corresponding multi-view instances for each one.
   * This ensures that any maps loaded before the plugin initialization
   * are also available in the multi-view system.
   */
  async function initializeMultiViewMaps(): Promise<void> {
    if (config.allowedSideMaps && config.allowedSideMaps.length > 0) {
      // take from config
      availableSideMapClasses.value = [...config.allowedSideMaps];
    }

    // check if an oblique collection is available for a configured ObliqueMap and remove if not.
    if (app.obliqueCollections.size === 0) {
      availableSideMapClasses.value = availableSideMapClasses.value.filter(
        (mapClassName) =>
          ![ObliqueMap.className, ObliqueMultiView.className].includes(
            mapClassName,
          ),
      );
    }

    // check if we have a PanoramaDataset, if not remove PanoramaMap from available maps
    if (
      ![...app.layers].some((layer) => layer instanceof PanoramaDatasetLayer)
    ) {
      availableSideMapClasses.value = availableSideMapClasses.value.filter(
        (mapClassName) => PanoramaMap.className !== mapClassName,
      );
    }

    if (availableSideMapClasses.value.length > 0) {
      if (
        config.startingSideMap &&
        availableSideMapClasses.value.includes(config.startingSideMap)
      ) {
        await setActiveSideMap(config.startingSideMap);
      } else if (
        availableSideMapClasses.value.includes(ObliqueMultiView.className)
      ) {
        await setActiveSideMap(ObliqueMultiView.className);
      } else {
        await setActiveSideMap(availableSideMapClasses.value[0]);
      }
    }
  }

  const mapsListener = [
    app.maps.mapActivated.addEventListener((map) => {
      mainViewChangedEvent.setActiveMap(map);
      updateObliqueCollectionChangedListener(map);
    }),
    app.maps.added.addEventListener(() => {
      app.panelManager.remove(pluginName);
    }),
    app.maps.removed.addEventListener(() => {
      app.panelManager.remove(pluginName);
    }),
  ];

  return {
    isSync,
    availableSideMapClasses,
    activeSideMap,
    currentMainMapViewpoint,
    setActiveSideMap,
    initializeMultiViewMaps,
    toggleSync,
    switchMaps,
    destroy(): void {
      sideMapCache.values().forEach((sideMap) => {
        sideMap.deactivate();
        sideMap.destroy();
      });
      sideMapCache.clear();

      // main map listener
      mapsListener.forEach((listener) => {
        listener();
      });

      destroyMultiviewPanoramaInteraction();
      sideMapEventHandler.destroy();
      // Event for view changes
      mainViewChangedEvent.destroy();
      removeObliqueCollectionChangedListener?.();
    },
  };
}
