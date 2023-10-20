<template>
  <div class="relative">
    <VcsMap :map-id="mapId" class="absolute fill" />
    <v-sheet class="absolute px-2 map-button-container">
      <VcsButton @click="$emit('click', title)" :active="active">
        {{ $t(title) }}
      </VcsButton>
    </v-sheet>
  </div>
</template>

<script>
  import { VSheet } from 'vuetify/lib';
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
  };
</script>

<style lang="scss" scoped>
  .relative {
    position: relative;
  }
  .absolute {
    position: absolute;
  }
  .fill {
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    overflow: hidden;
  }
  .map-button-container {
    top: 2px;
    left: 2px;
    height: 24px;
  }
</style>
