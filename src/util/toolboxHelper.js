import { ToolboxType } from '@vcmap/ui';
import { reactive, watch } from 'vue';

/**
 * Adds the multi view button to the toolbox and handles changes to title, active and disabled of the action.
 * @param {import("@vcmap/ui").VcsUiApp} app The VcsUiApp instance.
 * @param {import("../multiViewManager").MultiViewManager} multiViewManager The multiViewManager instance.
 * @param {string} name The name of the plugin.
 * @returns {function():void} Remove callback for button.
 */
export default function addMultiViewButton(app, multiViewManager, name) {
  /**
   * @param {boolean} isActive
   * @returns {string}
   */
  function getToggleTitle(isActive) {
    if (isActive) {
      return 'multiView.deactivate';
    } else {
      return 'multiView.activate';
    }
  }

  const action = reactive({
    name: 'multi-view-action',
    title: getToggleTitle(multiViewManager.active),
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
      action.title = getToggleTitle(activeState);
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
