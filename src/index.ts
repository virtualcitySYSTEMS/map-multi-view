import {
  PanelLocation,
  type PluginConfigEditor,
  ToolboxType,
  type VcsAction,
  type VcsPlugin,
  type VcsUiApp,
} from '@vcmap/ui';
import { reactive } from 'vue';
import { mapVersion, name as pluginName, version } from '../package.json';
import MultiViewComponent from './MultiViewComponent.vue';
import MultiViewConfigEditor from './MultiViewConfigEditor.vue';
import { getDefaultOptions } from './defaultOptions.js';
import { activateWhenFirstMapLoaded } from './activationHelper.js';

export type MultiViewPluginConfig = {
  activeOnStartup: boolean; // default is false
  startingSideMap?: string;
  allowedSideMaps: string[];
  obliqueCollectionName?: string;
};

type MultiViewPluginState = {
  /** The active `sideMap` or undefined if none */
  sm?: string;
  /** The `width` of the side map panel */
  w: string;
};

export type MultiViewPlugin = VcsPlugin<
  Partial<MultiViewPluginConfig>,
  MultiViewPluginState
> & {
  readonly config: MultiViewPluginConfig;
  readonly state: MultiViewPluginState;
};

export default function plugin(
  options: MultiViewPluginConfig,
): MultiViewPlugin {
  const pluginConfig: MultiViewPluginConfig = {
    ...getDefaultOptions(),
    ...options,
  };
  const state = reactive<MultiViewPluginState>({
    sm: undefined,
    w: '25%',
  });
  let app: VcsUiApp | undefined;
  const panelManagerListener: (() => void)[] = [];
  let removeMapActiveListener: (() => void) | undefined;

  const action: VcsAction = reactive({
    name: pluginName,
    title: 'multiView.title',
    icon: '$vcsMultiView',
    active: false,
    disabled: true,
    callback(): void {
      if (this.active) {
        app!.panelManager.remove(pluginName);
      } else {
        app!.panelManager.add(
          {
            id: pluginName,
            component: MultiViewComponent,
            position: { width: state.w },
          },
          pluginName,
          PanelLocation.RIGHT,
        );
      }
    },
  });

  return {
    get name(): string {
      return pluginName;
    },
    get version(): string {
      return version;
    },
    get mapVersion(): string {
      return mapVersion;
    },
    get config(): MultiViewPluginConfig {
      return { ...getDefaultOptions(), ...pluginConfig };
    },
    state,
    initialize(vcsUiApp: VcsUiApp, pluginState?: MultiViewPluginState): void {
      app = vcsUiApp;
      action.disabled = false;
      state.sm = pluginState?.sm;
      state.w = pluginState?.w ?? '25%';

      panelManagerListener.push(
        app.panelManager.added.addEventListener((panel) => {
          if (panel.id === pluginName) {
            action.active = true;
          }
        }),
      );
      panelManagerListener.push(
        app.panelManager.removed.addEventListener((panel) => {
          if (panel.id === pluginName) {
            action.active = false;
            state.sm = undefined;
          }
        }),
      );
      panelManagerListener.push(
        app.panelManager.positionChanged.addEventListener(
          ({ panelId, panelPosition }) => {
            if (panelId === pluginName) {
              state.w = panelPosition.width;
            }
          },
        ),
      );

      vcsUiApp.toolboxManager.add(
        {
          id: 'multi-view',
          type: ToolboxType.SINGLE,
          action,
        },
        pluginName,
      );
    },
    onVcsAppMounted(vcsUiApp: VcsUiApp): void {
      if (!!state.sm || pluginConfig.activeOnStartup) {
        if (!!state.sm && pluginConfig.allowedSideMaps.includes(state.sm)) {
          pluginConfig.startingSideMap = state.sm;
        }
        removeMapActiveListener = activateWhenFirstMapLoaded(vcsUiApp, action);
      }
    },
    getState(): MultiViewPluginState {
      return state;
    },
    i18n: {
      en: {
        multiView: {
          config: {
            title: 'MultiView configuration',
            activeOnStartup: 'Activate side map on startup',
            allowedSideMaps: 'Allowed side maps',
            startingSideMap: 'Side map displayed at startup',
            placeholder: 'Select',
            obliqueCollectionName: 'Name of the oblique imagery collection',
          },
          title: 'Show side map',
          north: 'north',
          east: 'east',
          south: 'south',
          west: 'west',
          sync: 'Synchronize views',
          switchMaps: 'Switch views',
          obliqueMultiView: 'Oblique multiview',
        },
      },
      de: {
        multiView: {
          config: {
            title: 'MultiView Konfiguration',
            activeOnStartup: 'Nebenkarte beim Start aktivieren',
            allowedSideMaps: 'Erlaubte Nebenkarten',
            startingSideMap: 'Nebenkarte, die beim Start angezeigt wird',
            placeholder: 'Auswählen',
            obliqueCollectionName: 'Name der Schrägluftbildebene',
          },
          title: 'Nebenkarte anzeigen',
          north: 'Norden',
          east: 'Osten',
          south: 'Süden',
          west: 'Westen',
          sync: 'Ansichten synchronisieren',
          switchMaps: 'Ansichten vertschauschen',
          obliqueMultiView: 'Schrägluftbild Mehrfachansicht',
        },
      },
    },
    getConfigEditors(): PluginConfigEditor<object>[] {
      return [
        {
          component: MultiViewConfigEditor,
          title: 'multiView.config.title',
        },
      ];
    },
    toJSON(): Partial<MultiViewPluginConfig> {
      const serial: Partial<MultiViewPluginConfig> = {};
      const defaultOptions = getDefaultOptions();
      if (options.activeOnStartup !== defaultOptions.activeOnStartup) {
        serial.activeOnStartup = options.activeOnStartup;
      }
      if (options.startingSideMap) {
        serial.startingSideMap = options.startingSideMap;
      }
      if (
        options.allowedSideMaps &&
        options.allowedSideMaps.length > 0 &&
        (options.allowedSideMaps.length !==
          defaultOptions.allowedSideMaps.length ||
          !options.allowedSideMaps.every((map) =>
            defaultOptions.allowedSideMaps.includes(map),
          ))
      ) {
        serial.allowedSideMaps = options.allowedSideMaps;
      }
      if (options.obliqueCollectionName) {
        serial.obliqueCollectionName = options.obliqueCollectionName;
      }
      return serial;
    },
    destroy(): void {
      panelManagerListener.forEach((listener) => {
        listener();
      });
      app?.toolboxManager?.removeOwner(pluginName);
      removeMapActiveListener?.();
      app?.panelManager.remove(pluginName);
      app = undefined;
    },
  };
}
