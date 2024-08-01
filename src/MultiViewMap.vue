<template>
  <div class="position-relative">
    <VcsMap :map-id="mapId" class="position-absolute fill" />
    <v-sheet class="position-absolute px-2 map-button-container">
      <VcsButton @click="$emit('click', title)" :active="active">
        {{ $t(title) }}
      </VcsButton>
    </v-sheet>
  </div>
</template>

<script lang="ts">
  import { VSheet } from 'vuetify/components';
  import { VcsButton, VcsMap } from '@vcmap/ui';

  export default {
    components: {
      VcsMap,
      VSheet,
      VcsButton,
    },
    name: 'MultiViewMap',
    props: {
      active: {
        type: Boolean,
        required: false,
        default: false,
      },
      title: {
        type: String,
        required: true,
      },
      mapId: {
        type: String,
        required: true,
      },
    },
    emits: ['click'],
  };
</script>

<style lang="scss" scoped>
  .fill {
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    overflow: hidden;
  }
  .map-button-container {
    top: 4px;
    left: 6px;
    height: 24px;
  }
</style>
