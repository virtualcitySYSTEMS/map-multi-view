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

export type MultiViewPluginConfig = {
  activeOnStartup: boolean; // default is false
  startingSideMap?: string;
  allowedSideMaps: string[];
  obliqueCollectionName?: string;
};

export type MultiViewPlugin = VcsPlugin<
  Partial<MultiViewPluginConfig>,
  Record<never, never>
> & {
  readonly config: MultiViewPluginConfig;
};

export default function plugin(
  options: MultiViewPluginConfig,
): MultiViewPlugin {
  const pluginConfig: MultiViewPluginConfig = {
    ...getDefaultOptions(),
    ...options,
  };
  let app: VcsUiApp | undefined;
  const panelManagerListener: (() => void)[] = [];

  let removeMapActiveListener: (() => void) | undefined;

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
    initialize(vcsUiApp: VcsUiApp): void {
      app = vcsUiApp;
      const action: VcsAction = reactive({
        name: pluginName,
        title: 'multiView.title',
        icon: '$vcsMultiView',
        active: false,
        callback(): void {
          if (this.active) {
            vcsUiApp.panelManager.remove(pluginName);
          } else {
            vcsUiApp.panelManager.add(
              {
                id: pluginName,
                component: MultiViewComponent,
              },
              pluginName,
              PanelLocation.RIGHT,
            );
          }
        },
      });
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
          }
        }),
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
      if (pluginConfig.activeOnStartup) {
        // only activate if we have an activeMap, otherwise wait.
        if (vcsUiApp.maps.activeMap) {
          vcsUiApp.panelManager.add(
            {
              id: pluginName,
              component: MultiViewComponent,
            },
            pluginName,
            PanelLocation.RIGHT,
          );
        } else {
          removeMapActiveListener = vcsUiApp.maps.mapActivated.addEventListener(
            () => {
              removeMapActiveListener?.();
              vcsUiApp.panelManager.add(
                {
                  id: pluginName,
                  component: MultiViewComponent,
                },
                pluginName,
                PanelLocation.RIGHT,
              );
            },
          );
        }
      }
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
