import { ToolboxType, type VcsUiApp } from '@vcmap/ui';
import { reactive, watch } from 'vue';
import { MultiViewManager } from '../multiViewManager.js';

/**
 * Adds the multi view button to the toolbox and handles changes to title, active and disabled of the action.
 * @param app The VcsUiApp instance.
 * @param multiViewManager The multiViewManager instance.
 * @param name The name of the plugin.
 * @returns Remove callback for button.
 */
export default function addMultiViewButton(
  app: VcsUiApp,
  multiViewManager: MultiViewManager,
  name: string,
): () => void {
  const action = reactive({
    name: 'multi-view-action',
    title: 'multiView.title',
    icon: '$vcsMultiView',
    active: multiViewManager.active,
    background: false,
    disabled: false,
    async callback() {
      if (multiViewManager.active) {
        multiViewManager.deactivate();
      } else {
        await multiViewManager.activate();
      }
    },
  });

  const stateChangedListener = multiViewManager.stateChanged.addEventListener(
    (activeState) => {
      action.active = activeState;
    },
  );

  const disabledWatcher = watch(
    multiViewManager.disabled,
    (newValue) => {
      action.disabled = newValue;
    },
    { immediate: true },
  );

  const button = app.toolboxManager.add(
    {
      id: name,
      type: ToolboxType.SINGLE,
      action,
    },
    name,
  );

  return () => {
    app.toolboxManager.remove(button.id);
    stateChangedListener();
    disabledWatcher();
  };
}
