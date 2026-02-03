import {
  CesiumMap,
  ObliqueMap,
  OpenlayersMap,
  PanoramaMap,
  VcsEvent,
  type VcsMap,
} from '@vcmap/core';

export default class MainViewChangedEvent extends VcsEvent<VcsMap> {
  private _activeListener: (() => void)[] = [];

  public setActiveMap(map: VcsMap | null): void {
    const triggerEvent: () => void = () => {
      if (map) {
        this.raiseEvent(map);
      }
    };

    this._activeListener.forEach((l) => {
      l();
    });
    this._activeListener = [];

    if (map instanceof CesiumMap || map instanceof PanoramaMap) {
      const camera = map.getCesiumWidget()?.camera;
      if (camera) {
        camera.percentageChanged = 0.00001;
        this._activeListener.push(
          camera.changed.addEventListener(triggerEvent),
        );
      }
    } else if (map instanceof ObliqueMap) {
      this._activeListener.push(map.postRender.addEventListener(triggerEvent));
    } else if (map instanceof OpenlayersMap) {
      if (map.olMap) {
        const { olMap } = map;
        olMap.on('moveend', triggerEvent);
        this._activeListener.push(() => {
          olMap.un('moveend', triggerEvent);
        });

        const view = olMap.getView();
        if (view) {
          view.on('change:center', triggerEvent);
          view.on('change:resolution', triggerEvent);
          this._activeListener.push(() => {
            view.un('change:center', triggerEvent);
            view.un('change:resolution', triggerEvent);
          });
        }
      }
    }
    // trigger event once at map changed listener
    triggerEvent();
  }

  public override destroy(): void {
    try {
      this._activeListener.forEach((removeListener) => {
        removeListener();
      });
    } catch (error) {
      throw new Error(
        `cannot destroy viewChangedEvent: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      super.destroy();
    }
  }
}
