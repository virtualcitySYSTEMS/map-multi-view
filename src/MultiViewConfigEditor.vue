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
            multiple
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
            :placeholder="$t('multiView.config.placeholder')"
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
            :placeholder="$t('multiView.config.placeholder')"
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
  import { type MultiViewPluginConfig } from './index.js';
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
  const defaultOptions = getDefaultOptions();

  const config: MultiViewPluginConfig = props.getConfig();
  const localConfig = ref({
    ...defaultOptions,
    ...structuredClone(config),
  });

  const availableMapClasses = defaultOptions.allowedSideMaps;

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
    (collection) => {
      return {
        value: collection.name,
        title: collection?.properties?.title || collection.name,
      };
    },
  );

  function apply(): void {
    props.setConfig(structuredClone(toRaw(localConfig.value)));
  }
</script>
