export const multiViewPanelId = 'vcmap-multi-view-panel';
export const multiViewSlotId = 'vcmap-multi-view-slot';

/**
 * Sets a column right to the container with the vcs-main css class.
 * @returns {function():void} Callback function for resetting the layout.
 */
export function setColumnRight() {
  const vcsMain = /** @type {HTMLDivElement} */ (
    document.getElementsByClassName('vcs-main')[0]
  );
  const panel = vcsMain.parentElement?.appendChild(
    document.createElement('div'),
  );
  const slot = panel?.appendChild(document.createElement('div'));

  const initialVW = 20;
  const borderWidth = 4;
  const maxVW = 33;
  const minVW = 10;

  // setup vcs-main element
  vcsMain.style.width = `${100 - initialVW}vw`;
  vcsMain.style.right = 'unset';
  vcsMain.style.minWidth = `${100 - maxVW}vw`;
  vcsMain.style.maxWidth = `${100 - minVW}vw`;

  // setup view panel
  panel.id = multiViewPanelId;
  slot.id = multiViewSlotId;

  const panelCssRules = `
    #${multiViewPanelId} {
      position: absolute;
      top: 48px;
      bottom: 22px;
      right: 0;
      padding-left: ${borderWidth}px;
      width: ${initialVW}vw;
      max-width: ${maxVW}vw;
      min-width: ${minVW}vw;
    }

    #${multiViewPanelId}::after {
      content: '';
      position: absolute;
      left: 0;
      width: ${borderWidth}px;
      height: 100%;
      cursor: ew-resize;
    }
  `;

  const panelCssSheet = document.createElement('style');
  panelCssSheet.innerHTML = panelCssRules;
  document.body.appendChild(panelCssSheet);

  let mousePosition;
  /**
   * Event listener when dragging the border of the column in order to resize the column/panel.
   * @param {MouseEvent} event The mouse move event.
   */
  function resize(event) {
    const dx = mousePosition - event.x;
    const { clientWidth } = document.documentElement;
    const newPanelWidth = parseInt(getComputedStyle(panel, '').width, 10) + dx;
    const panelShare = (newPanelWidth / clientWidth) * 100;
    const vcsMainShare = 100 - panelShare;
    mousePosition = event.x;
    panel.style.width = `${panelShare}%`;
    vcsMain.style.width = `${vcsMainShare}%`;
  }

  panel.addEventListener(
    'mousedown',
    (event) => {
      if (event.offsetX < borderWidth) {
        mousePosition = event.x;
        document.addEventListener('mousemove', resize, false);
      }
    },
    false,
  );

  const mouseupEventListener = () => {
    document.removeEventListener('mousemove', resize, false);
  };

  document.addEventListener('mouseup', mouseupEventListener, false);

  return () => {
    panel?.remove();
    vcsMain.style.width = '';
    vcsMain.style.right = '';
    vcsMain.style.minWidth = '';
    vcsMain.style.maxWidth = '';
    document.removeEventListener('mouseup', mouseupEventListener, false);

    const parent = panelCssSheet.parentNode;
    parent?.removeChild(panelCssSheet);
  };
}
