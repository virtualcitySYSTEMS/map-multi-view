import {
  getHeightFromTerrainProvider,
  type LayerCollection,
  type MapEvent,
  type ObliqueCollection,
  VcsEvent,
} from '@vcmap/core';
import { ObliqueMap, Viewpoint } from '@vcmap/core';

export default class ObliqueMultiView {
  public northMap: ObliqueMap;
  public southMap: ObliqueMap;
  public eastMap: ObliqueMap;
  public westMap: ObliqueMap;
  public maps: ObliqueMap[];

  static get className(): string {
    return 'ObliqueMultiView';
  }
  private _target: HTMLElement | null;
  public mapElement: HTMLElement;
  public layerCollection: LayerCollection | null;
  public pointerInteractionEvent: VcsEvent<MapEvent>;

  constructor() {
    this.northMap = new ObliqueMap({ switchOnEdge: false });
    this.eastMap = new ObliqueMap({ switchOnEdge: false });
    this.southMap = new ObliqueMap({ switchOnEdge: false });
    this.westMap = new ObliqueMap({ switchOnEdge: false });
    this.maps = [this.northMap, this.eastMap, this.southMap, this.westMap];

    this._target = null;
    this.mapElement = document.createElement('div');
    this.mapElement.classList.add('absolute-fill', 'multi-view-grid');
    this.pointerInteractionEvent = new VcsEvent();
    this.layerCollection = null;
  }
  get className(): string {
    return (this.constructor as typeof ObliqueMultiView).className;
  }

  async activate(): Promise<void> {
    await Promise.all(this.maps.map((map) => map.activate()));
  }

  async setCollection(collection: ObliqueCollection): Promise<void> {
    await Promise.all(this.maps.map((map) => map.setCollection(collection)));
  }

  deactivate(): void {
    this.maps.forEach((map) => {
      map.deactivate();
    });
  }

  setTarget(target: string | HTMLElement): void {
    if (this._target) {
      this._target.removeChild(this.mapElement);
    }
    this._target =
      typeof target === 'string' ? document.getElementById(target) : target;
    if (this._target) {
      this.maps.forEach((map) => {
        map.setTarget(this.mapElement);
      });
      this.northMap.mapElement.classList.add('grid-area-1');
      this.eastMap.mapElement.classList.add('grid-area-2');
      this.southMap.mapElement.classList.add('grid-area-3');
      this.westMap.mapElement.classList.add('grid-area-4');
      this._target.appendChild(this.mapElement);
    }
  }

  async gotoViewpoint(viewpoint: Viewpoint): Promise<void> {
    const groundPosition =
      viewpoint.groundPosition ?? viewpoint.cameraPosition ?? undefined;
    const { distance } = viewpoint;
    if (!groundPosition) {
      return;
    }
    if (!groundPosition[2]) {
      // we do not have a height value, so we calculate the height Value from the terrainProvider,
      // so the oblique maps dont have to do it for each direction.
      const terrainProvider = this.northMap.currentImage?.meta?.terrainProvider;
      if (terrainProvider) {
        await getHeightFromTerrainProvider(
          terrainProvider,
          [groundPosition],
          undefined,
          [groundPosition],
        );
      }
    }
    await Promise.all([
      this.northMap.gotoViewpoint(
        new Viewpoint({
          groundPosition,
          distance,
          heading: 0,
        }),
      ),
      this.eastMap.gotoViewpoint(
        new Viewpoint({
          groundPosition,
          distance,
          heading: 90,
        }),
      ),
      this.southMap.gotoViewpoint(
        new Viewpoint({
          groundPosition,
          distance,
          heading: 180,
        }),
      ),
      this.westMap.gotoViewpoint(
        new Viewpoint({
          groundPosition,
          distance,
          heading: 270,
        }),
      ),
    ]);
  }

  destroy(): void {
    this.maps.forEach((map) => {
      map.destroy();
    });
    this.maps.length = 0;
    if (this.mapElement) {
      if (this.mapElement.parentElement) {
        this.mapElement.parentElement.removeChild(this.mapElement);
      }
      this.mapElement = document.createElement('div');
      this._target = null;
    }
    this.layerCollection = null;
    this.pointerInteractionEvent.destroy();
  }
}
