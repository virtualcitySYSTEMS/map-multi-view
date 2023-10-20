import Vue from 'vue';
import { vuetify } from '@vcmap/ui';
import { Viewpoint } from '@vcmap/core';
import { multiViewSlotId } from './layoutHelper.js';
import MultiViewGrid from '../MultiViewGrid.vue';

/**
 *
 * @param {import("vue-i18n").IVueI18n} i18n The i18n from the VcsUiApp to make sure that language is in sync.
 * @param {Array<string>} viewTitles The titles for the different views.
 * @param {import("vue").Ref<number | undefined>} activeView A ref with the index of the active view.
 * @param {function(number):void} viewpointHandler A function that handles 'viewpoint' events of the MultiViewGrid component. These are emitted, when the upper left button is clicked and contains the index of the view where the button is located.
 * @returns {function():void} Destroy callback for the multi view component.
 */
export function mountMultiViewComponent(
  i18n,
  viewTitles,
  activeView,
  viewpointHandler,
) {
  const MultiViewComponent = Vue.extend(MultiViewGrid);
  const multiView = new MultiViewComponent({
    propsData: {
      viewTitles,
      activeView,
    },
    i18n,
    vuetify,
  });

  multiView.$mount(`#${multiViewSlotId}`);
  multiView.$on('viewpoint', viewpointHandler);

  return () => {
    multiView.$destroy();
  };
}

/**
 * Applies the viewpoint of one of the multi views to the main map.
 * @param {import("@vcmap/core").VcsApp} app The VcsUiApp instance.
 * @param {Map<number, import("@vcmap/core").VcsMap>} views The views with view index as key and corresponding map as value.
 * @param {number} index Index of the view whose viewpoint is to be applied to the main map.
 */
export async function handleJumpToViewpoint(app, views, index) {
  const viewpointOfIndex = await views.get(index)?.getViewpoint();
  const currentViewpoint = await app.maps.activeMap?.getViewpoint();
  if (viewpointOfIndex && currentViewpoint) {
    const newViewpoint = new Viewpoint({
      groundPosition: viewpointOfIndex.groundPosition || undefined,
      heading: viewpointOfIndex.heading,
      pitch: -45,
      distance: currentViewpoint.distance,
    });
    app.maps.activeMap?.gotoViewpoint(newViewpoint);
  }
}
