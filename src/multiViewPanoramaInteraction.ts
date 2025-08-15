import { type InteractionEvent, PanoramaMap, type VcsApp } from '@vcmap/core';
import { AbstractInteraction, EventType, panoramaFeature } from '@vcmap/core';
import type { Feature } from 'ol';
import { type Ref } from 'vue';
import { type AllowedMapType } from './multiViewHandler';

export default class MultiViewPanoramaInteraction extends AbstractInteraction {
  constructor(
    private _app: VcsApp,
    private _activeSideMap: Ref<AllowedMapType | null>,
    private _setActiveSideMap: (newMapClass: string) => Promise<void>,
    private _source: 'mainMap' | 'sideMap' | 'overviewMap',
  ) {
    super(EventType.CLICK);
  }

  override async pipe(event: InteractionEvent): Promise<InteractionEvent> {
    if (event.feature && (event.feature as Feature)[panoramaFeature]) {
      const { dataset, name } = (event.feature as Feature)[panoramaFeature]!;
      const panoramaImage = await dataset.createPanoramaImage(name);
      event.stopPropagation = true;

      const mainMap = this._app.maps.activeMap;
      const sideMap = this._activeSideMap.value;
      if (mainMap instanceof PanoramaMap && sideMap instanceof PanoramaMap) {
        if (this._source === 'mainMap' || this._source === 'overviewMap') {
          mainMap.setCurrentImage(panoramaImage);
        } else if (this._source === 'sideMap') {
          sideMap.setCurrentImage(panoramaImage);
        }
      } else if (
        mainMap instanceof PanoramaMap &&
        !(sideMap instanceof PanoramaMap)
      ) {
        mainMap.setCurrentImage(panoramaImage);
      } else if (sideMap instanceof PanoramaMap) {
        sideMap.setCurrentImage(panoramaImage);
      } else {
        // activate SideMap
        await this._setActiveSideMap(PanoramaMap.className);
        if (this._activeSideMap.value instanceof PanoramaMap) {
          this._activeSideMap.value.setCurrentImage(panoramaImage);
        }
      }
    }
    return event;
  }
}
