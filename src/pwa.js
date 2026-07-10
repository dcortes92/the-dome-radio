/** Register SW unless #skip or Vite dev. */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (location.hash === '#skip') return;
  if (import.meta.env.DEV) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
