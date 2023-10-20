import { ObliqueMap, ObliqueViewDirection } from '@vcmap/core';
import { name, version, mapVersion } from '../package.json';
import createMultiViewManager from './multiViewManager.js';
import addMultiViewButton from './util/toolboxHelper.js';

/**
 * @typedef {Object} AbstractMultiView
 * @property {string} map The map type.
 */

/**
 * @typedef {Object} ObliqueMultiViewProps
 * @property {string?} collection The collection that should be displayed in this view. If null, the oblique collection of the current oblique map is displayed.
 * @property {import("@vcmap/core").ObliqueViewDirection} direction The direction of the oblique collection.
 * @typedef {AbstractMultiView & ObliqueMultiViewProps} ObliqueMultiView The properties to define a oblique view for the multi view.
 */

/**
 * @typedef {Object} MultiViewConfig The multiView internal config, to lay the foundation for later config/state. In version 2 this is more like a state since it can be modified during runtime.
 * @property {Array<ObliqueMultiView>} views The definition of the different views.
 */

/** @type {MultiViewConfig} */
export const viewConfig = {
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

/**
 * @typedef {Object} MultiViewState
 * @property {boolean} active Whether the plugin is active
 */

/**
 * Implementation of VcsPlugin interface. This function should not throw! Put exceptions in initialize instead.
 * @param {T} config - the configuration of this plugin instance, passed in from the app.
 * @param {string} baseUrl - the absolute URL from which the plugin was loaded (without filename, ending on /)
 * @returns {import("@vcmap/ui/src/vcsUiApp").VcsPlugin<T, MultiViewState>}
 * @template {Object} T
 */
// eslint-disable-next-line no-unused-vars
export default function plugin(config, baseUrl) {
  /** @type {import("./multiViewManager").MultiViewManager} */
  let multiViewManager;
  let destroyButton = () => {};
  let mapAddedListener = () => {};

  return {
    get name() {
      return name;
    },
    get version() {
      return version;
    },
    get mapVersion() {
      return mapVersion;
    },
    get multiView() {
      return multiViewManager;
    },
    get active() {
      return multiViewManager?.active;
    },
    async activate() {
      await multiViewManager?.activate();
    },
    deactivate() {
      multiViewManager?.deactivate();
    },
    get stateChanged() {
      return multiViewManager.stateChanged;
    },
    /**
     * @param {import("@vcmap/ui").VcsUiApp} vcsUiApp
     * @param {MultiViewState=} state
     * @returns {Promise<void>}
     */
    initialize: async (vcsUiApp, state) => {
      multiViewManager = createMultiViewManager(vcsUiApp, viewConfig);
      destroyButton = addMultiViewButton(vcsUiApp, multiViewManager, name);
      mapAddedListener = vcsUiApp.maps.added.addEventListener((map) => {
        if (map instanceof ObliqueMap) {
          map.initialize();
        }
      });
      // needs to be initialized, otherwise it might not contain a collection.
      await vcsUiApp.maps.getByType(ObliqueMap.className)[0]?.initialize();
      if (state?.active) {
        await multiViewManager.activate();
      }
    },
    /**
     * should return all default values of the configuration
     * @returns {Object}
     */
    getDefaultOptions() {
      return {};
    },
    /**
     * should return the plugin's serialization excluding all default values
     * @returns {Object}
     */
    toJSON() {
      return {};
    },
    /**
     * should return the plugins state
     * @returns {MultiViewState}
     */
    getState() {
      return {
        active: multiViewManager?.active,
      };
    },
    /**
     * components for configuring the plugin and/ or custom items defined by the plugin
     * @returns {Array<import("@vcmap/ui").PluginConfigEditor>}
     */
    getConfigEditors() {
      return [];
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
    destroy() {
      destroyButton();
      multiViewManager.destroy();
      mapAddedListener();
    },
  };
}
