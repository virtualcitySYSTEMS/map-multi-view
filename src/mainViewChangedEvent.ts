import {
  CesiumMap,
  ObliqueMap,
  OpenlayersMap,
  PanoramaMap,
  VcsEvent,
  type VcsMap,
} from '@vcmap/core';

export default class MainViewChangedEvent extends VcsEvent<VcsMap> {
  // eslint-disable-next-line class-methods-use-this
  private _activeListener: () => void = () => {};

  public setActiveMap(map: VcsMap | null): void {
    const triggerEvent: () => void = () => {
      if (map) {
        this.raiseEvent(map);
      }
    };

    this._activeListener();

    if (map instanceof CesiumMap || map instanceof PanoramaMap) {
      const camera = map.getCesiumWidget()?.camera;
      if (camera) {
        camera.percentageChanged = 0.00001;
        this._activeListener = camera.changed.addEventListener(triggerEvent);
      }
    } else if (map instanceof ObliqueMap) {
      this._activeListener = map.postRender.addEventListener(triggerEvent);
    } else if (map instanceof OpenlayersMap) {
      if (map.olMap) {
        const view = map.olMap.getView();
        if (view) {
          view.on('change:center', triggerEvent);
          view.on('change:resolution', triggerEvent);
          this._activeListener = (): void => {
            view.un('change:center', triggerEvent);
            view.un('change:resolution', triggerEvent);
          };
        }
      }
    }
    // trigger event once at map changed listener
    triggerEvent();
  }

  public override destroy(): void {
    try {
      this._activeListener();
    } catch (error) {
      throw new Error(
        `cannot destroy viewChangedEvent: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      super.destroy();
    }
  }
}
