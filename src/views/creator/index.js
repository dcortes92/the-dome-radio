/** Frozen Creator/Studio/On-air prototype — loaded only when tab shown (hidden in v1). */
export function loadCreatorModules() {
  return import('./legacy.js');
}

export function initCreatorViews() {
  /* legacy IIFEs self-register window.initCreator */
}
