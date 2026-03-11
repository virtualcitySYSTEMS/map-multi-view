import { CesiumMap, ObliqueMap } from '@vcmap/core';
import type { VcsMap, ObliqueImage, VcsEvent } from '@vcmap/core';
import { callSafeAction, type VcsAction, type VcsUiApp } from '@vcmap/ui';
import type { Event } from '@vcmap-cesium/engine';

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

export function activateWhenFirstMapLoaded(
  app: VcsUiApp,
  action: VcsAction,
): () => void {
  const { maps } = app;
  let mapActivatedListener = (): void => {};
  let mapLoadedListener: (() => void) | undefined;

  function activateWhenMapLoaded(map: VcsMap): void {
    mapLoadedListener?.();
    if (isMapLoaded(map)) {
      mapActivatedListener();
      if (!action.active) {
        callSafeAction(action);
      }
    } else {
      mapLoadedListener = getMapLoadedEvent(map)?.addEventListener(() => {
        if (isMapLoaded(map)) {
          mapActivatedListener();
          mapLoadedListener?.();
          if (!action.active) {
            callSafeAction(action);
          }
        }
      });
    }
  }

  if (maps.activeMap) {
    activateWhenMapLoaded(maps.activeMap);
  } else {
    mapActivatedListener = maps.mapActivated.addEventListener(
      activateWhenMapLoaded,
    );
  }

  return () => {
    mapActivatedListener?.();
    mapLoadedListener?.();
  };
}
