<template>
  <AbstractConfigEditor v-bind="{ ...$attrs, ...$props }" @submit="apply">
    <v-container class="pa-1">
      <v-row no-gutters>
        <v-col cols="6">
          <VcsLabel html-for="configActiveOnStartup">
            {{ $t('multiView.config.activeOnStartup') }}
          </VcsLabel>
        </v-col>
        <v-col cols="6" class="gc-2 d-flex">
          <VcsCheckbox
            id="configActiveOnStartup"
            v-model="localConfig.activeOnStartup"
            label="multiView.config.activeOnStartup"
            :true-value="true"
            :false-value="false"
          />
        </v-col>
      </v-row>
      <v-row no-gutters>
        <v-col cols="6">
          <VcsLabel html-for="configAllowedSideMaps">
            {{ $t('multiView.config.allowedSideMaps') }}
          </VcsLabel>
        </v-col>
        <v-col cols="6" class="gc-2 d-flex">
          <VcsSelect
            id="configAllowedSideMaps"
            v-model="localConfig.allowedSideMaps"
            clearable
            multiple
            :placeholder="$t('multiView.config.defaultAllowedSideMaps')"
            :items="availableMapClasses"
          />
        </v-col>
      </v-row>
      <v-row no-gutters>
        <v-col cols="6">
          <VcsLabel html-for="configStartingSideMap">
            {{ $t('multiView.config.startingSideMap') }}
          </VcsLabel>
        </v-col>
        <v-col cols="6" class="gc-2 d-flex">
          <VcsSelect
            id="configStartingSideMap"
            v-model="localConfig.startingSideMap"
            clearable
            :placeholder="$t('multiView.config.defaultStartingSideMap')"
            :items="availableSideMapClasses"
          />
        </v-col>
      </v-row>
      <v-row no-gutters>
        <v-col cols="6">
          <VcsLabel html-for="configObliqueCollectionName">
            {{ $t('multiView.config.obliqueCollectionName') }}
          </VcsLabel>
        </v-col>
        <v-col cols="6" class="gc-2 d-flex">
          <VcsSelect
            id="configObliqueCollectionName"
            v-model="localConfig.obliqueCollectionName"
            clearable
            :placeholder="$t('multiView.config.defaultObliqueCollectionName')"
            :items="availableObliqueCollections"
          />
        </v-col>
      </v-row>
    </v-container>
  </AbstractConfigEditor>
</template>

<script setup lang="ts">
  import type { PropType } from 'vue';
  import { inject, ref, toRaw, computed } from 'vue';
  import { VCol, VContainer, VRow } from 'vuetify/components';
  import {
    AbstractConfigEditor,
    VcsLabel,
    VcsCheckbox,
    VcsSelect,
    type VcsUiApp,
  } from '@vcmap/ui';
  import {
    CesiumMap,
    ObliqueMap,
    OpenlayersMap,
    PanoramaMap,
  } from '@vcmap/core';
  import { type MultiViewPluginConfig } from './index.js';
  import ObliqueMultiView from './obliqueMultiView';
  import { getDefaultOptions } from './defaultOptions';

  const props = defineProps({
    getConfig: {
      type: Function as PropType<() => MultiViewPluginConfig>,
      required: true,
    },
    setConfig: {
      type: Function as PropType<(config: object | undefined) => void>,
      required: true,
    },
  });

  const config: MultiViewPluginConfig = props.getConfig();
  const localConfig = ref({
    ...getDefaultOptions(),
    ...structuredClone(config),
  });

  const availableMapClasses = [
    ObliqueMap.className,
    CesiumMap.className,
    OpenlayersMap.className,
    PanoramaMap.className,
    ObliqueMultiView.className,
  ];

  const availableSideMapClasses = computed(() => {
    if (
      localConfig.value.allowedSideMaps &&
      localConfig.value.allowedSideMaps.length > 0
    ) {
      return localConfig.value.allowedSideMaps;
    }
    return availableMapClasses;
  });
  const app = inject<VcsUiApp>('vcsApp')!;
  const availableObliqueCollections = [...app.obliqueCollections].map(
    (collection) => collection.name,
  );

  function apply(): void {
    props.setConfig(structuredClone(toRaw(localConfig.value)));
  }
</script>
