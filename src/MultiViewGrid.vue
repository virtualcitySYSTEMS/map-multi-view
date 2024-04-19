<template>
  <v-app class="absolute-fill">
    <div class="absolute-fill multi-view-grid">
      <MultiViewMap
        v-for="(title, index) in viewTitles"
        :key="index"
        :style="`grid-area: view-${index};`"
        :title="title"
        :map-id="`multi-view-map-${index}`"
        @click="handleJumpToViewpoint(index)"
        :active="index === activeView"
      />
    </div>
  </v-app>
</template>

<script>
  import { VApp } from 'vuetify/lib';
  import { computed, inject } from 'vue';
  import { Viewpoint } from '@vcmap/core';
  import MultiViewMap from './MultiViewMap.vue';

  export default {
    components: {
      MultiViewMap,
      VApp,
    },
    name: 'MultiViewGrid',
    props: {
      viewTitles: {
        type: Array,
        required: true,
      },
    },
    setup(props) {
      /** @type {import("@vcmap/ui").VcsUiApp} */
      const app = inject('vcsApp');
      const plugin = app.plugins.getByKey('@vcmap/multi-view');
      /** @type {import("./multiViewManager.js").MultiViewManager} */
      const manager = plugin.multiView;
      const { views, activeView } = manager;

      const gridTemplateAreas = computed(() => {
        return props.viewTitles
          .map((title, index) => `"view-${index}"`)
          .join(' ');
      });

      /**
       * Applies the viewpoint of one of the multi views to the main map.
       * @param {number} index Index of the view whose viewpoint is to be applied to the main map.
       */
      async function handleJumpToViewpoint(index) {
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
      return {
        gridTemplateAreas,
        activeView,
        handleJumpToViewpoint,
      };
    },
  };
</script>

<style scoped>
  .absolute-fill {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    overflow: hidden;
  }
  .multi-view-grid {
    display: grid;
    grid-template-areas: v-bind(gridTemplateAreas);
    row-gap: 2px;
    column-gap: 2px;
    padding-left: 2px;
  }
</style>
