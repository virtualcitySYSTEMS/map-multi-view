<script setup lang="ts">
  import {
    VcsMap,
    VcsSelect,
    type VcsUiApp,
    OrientationToolsButton,
    VcsFormButton,
  } from '@vcmap/ui';
  import { ObliqueMap, CesiumMap, PanoramaMap } from '@vcmap/core';
  import { computed, inject, onMounted, onUnmounted } from 'vue';
  import { name as pluginName } from '../package.json';
  import {
    createMultiViewHandler,
    type MultiViewHandler,
  } from './multiViewHandler.js';
  import ObliqueMultiView from './obliqueMultiView.js';
  import type { MultiViewPlugin } from './index.js';

  const app = inject<VcsUiApp>('vcsApp')!;
  const plugin = app.plugins.getByKey(pluginName) as MultiViewPlugin;
  if (!plugin) {
    throw new Error(`Plugin ${pluginName} not found in app.`);
  }
  const multiViewHandler: MultiViewHandler = createMultiViewHandler(
    app,
    plugin.config,
  );

  function getI18nMapStrings(className: string): string {
    if (className === ObliqueMultiView.className) {
      return 'multiView.obliqueMultiView';
    }
    return `navbar.maps.${className}`;
  }
  const switchPossible = computed(() => {
    // only show the switch Button if sideMap and mainMap are compatible
    if (
      multiViewHandler.availableMainMapClasses.value.includes(
        multiViewHandler.activeSideMap.value?.className ?? '',
      ) &&
      multiViewHandler.availableSideMapClasses.value.includes(
        multiViewHandler.activeMainMapClassName.value ?? '',
      )
    ) {
      return true;
    }
    return false;
  });

  const activeSideMapClass = computed({
    get() {
      return multiViewHandler.activeSideMap.value?.className ?? '';
    },
    set(newMapClass: string) {
      multiViewHandler.setActiveSideMap(newMapClass).catch((error: unknown) => {
        // eslint-disable-next-line no-console
        console.log(`Failed to set active side map: ${String(error)}`);
      });
    },
  });
  const availableSideMaps = computed(() => {
    return multiViewHandler.availableSideMapClasses.value.map((mapClass) => {
      return {
        title: getI18nMapStrings(mapClass),
        value: mapClass,
      };
    });
  });

  function gotoViewpointMainMap(heading: number): void {
    if (
      [
        ObliqueMap.className,
        CesiumMap.className,
        PanoramaMap.className,
      ].includes(multiViewHandler.activeMainMapClassName.value ?? '')
    ) {
      app.maps.activeMap
        ?.getViewpoint()
        .then((viewpoint) => {
          if (!viewpoint) {
            return null;
          }
          viewpoint.heading = heading;
          return app.maps.activeMap?.gotoViewpoint(viewpoint);
        })
        .catch((error: unknown) => {
          // eslint-disable-next-line no-console
          console.error(
            `Failed to goto viewpoint in main map: ${String(error)}`,
          );
        });
    }
  }

  onMounted(() => {
    multiViewHandler.initializeMultiViewMaps().catch((error: unknown) => {
      // eslint-disable-next-line no-console
      console.error(`Failed to initialize multi view maps: ${String(error)}`);
    });
  });
  onUnmounted(() => {
    multiViewHandler.destroy();
  });

  function getVariant(
    heading: number | undefined,
    directionIndex: number,
  ): string {
    if (heading == null || heading === undefined) {
      return 'outlined';
    }
    const direction = ((Math.round(heading / 90) % 4) + 4) % 4;
    if (direction === directionIndex) {
      return 'filled';
    }
    return 'outlined';
  }

  const multiViewDirections = [
    {
      key: 'north',
      variant: computed(() => {
        return getVariant(
          multiViewHandler.currentMainMapViewpoint.value?.heading,
          0,
        );
      }),
      heading: 0,
      label: 'multiView.north',
      gridArea: 'grid-area-1',
    },
    {
      key: 'east',
      heading: 90,
      variant: computed(() => {
        return getVariant(
          multiViewHandler.currentMainMapViewpoint.value?.heading,
          1,
        );
      }),
      label: 'multiView.east',
      gridArea: 'grid-area-2',
    },
    {
      key: 'south',
      heading: 180,
      label: 'multiView.south',
      variant: computed(() => {
        return getVariant(
          multiViewHandler.currentMainMapViewpoint.value?.heading,
          2,
        );
      }),
      gridArea: 'grid-area-3',
    },
    {
      key: 'west',
      heading: 270,
      variant: computed(() => {
        return getVariant(
          multiViewHandler.currentMainMapViewpoint.value?.heading,
          3,
        );
      }),
      label: 'multiView.west',
      gridArea: 'grid-area-4',
    },
  ];
</script>

<template>
  <div class="multi-view-container">
    <VcsMap map-id="multi-view-map-container" class="map" />
    <div class="d-flex justify-start pa-1 ga-1">
      <OrientationToolsButton
        v-if="switchPossible"
        icon="mdi-swap-horizontal"
        :tooltip="$st('multiView.switchMaps')"
        @click="multiViewHandler.switchMaps"
      />
      <OrientationToolsButton
        icon="mdi-sync"
        :color="multiViewHandler.isSync.value ? 'primary' : undefined"
        :tooltip="$st('multiView.sync')"
        @click="multiViewHandler.toggleSync"
      />

      <VcsSelect
        v-if="availableSideMaps.length > 1"
        v-model="activeSideMapClass"
        class="select pa-0 flex-grow-0"
        bg-color="surface"
        :items="availableSideMaps"
      />
    </div>
    <div
      v-if="activeSideMapClass === ObliqueMultiView.className"
      class="absolute-fill multi-view-grid no-pointer"
    >
      <div
        v-for="direction in multiViewDirections"
        :key="direction.key"
        class="absolute-fill grid-area"
        :class="direction.gridArea"
      >
        <div class="d-flex justify-start pa-1 ga-1 corner-btn">
          <vcs-form-button
            :variant="direction.variant.value"
            class="form-btn"
            @click="gotoViewpointMainMap(direction.heading)"
          >
            {{ $st(direction.label) }}
          </vcs-form-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .no-pointer {
    pointer-events: none;
  }
  .grid-area {
    pointer-events: none;
    position: relative;
    width: 100%;
    height: 100%;
    padding-left: 4px;
  }
  .form-btn {
    background-color: rgb(var(--v-theme-surface));
    height: calc(var(--v-vcs-font-size) * 2) !important;
    padding-left: 8px !important;
    padding-right: 8px !important;
    border: 0;
  }

  .corner-btn {
    position: absolute;
    bottom: 0;
    pointer-events: auto;
  }
  .select :deep(.v-field) {
    padding: 4px;
  }
  :deep(.absolute-fill) {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    overflow: hidden;
  }
  :deep(.grid-area-1) {
    grid-area: view-1;
  }
  :deep(.grid-area-2) {
    grid-area: view-2;
  }
  :deep(.grid-area-3) {
    grid-area: view-3;
  }
  :deep(.grid-area-4) {
    grid-area: view-4;
  }
  .multi-view-container {
    container-type: inline-size;
  }
  :deep(.multi-view-grid) {
    display: grid;
    grid-template-areas:
      'view-1' 'view-2'
      'view-3' 'view-4';
    @container (width > 700px) {
      grid-template-areas:
        'view-1 view-2'
        'view-3 view-4';
    }
    row-gap: 2px;
    column-gap: 2px;
    padding-left: 0px;
  }
</style>
