<template>
  <v-app class="absolute-fill">
    <div class="absolute-fill multi-view-grid">
      <MultiViewMap
        v-for="(title, index) in viewTitles"
        :key="index"
        :style="`grid-area: view-${index};`"
        :title="title"
        :map-id="`multi-view-map-${index}`"
        @click="$emit('viewpoint', index)"
        :active="index === activeView"
      />
    </div>
  </v-app>
</template>

<script>
  import { VApp } from 'vuetify/lib';
  import { computed } from 'vue';
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
      activeView: {
        type: Object,
        required: false,
        default: undefined,
      },
    },
    setup(props) {
      const gridTemplateAreas = computed(() => {
        return props.viewTitles
          .map((title, index) => `"view-${index}"`)
          .join(' ');
      });
      return {
        gridTemplateAreas,
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
