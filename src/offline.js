export function initOfflineBanner() {
  const el = document.getElementById('offlineBanner');
  if (!el) return;
  const sync = () => {
    const offline = !navigator.onLine;
    el.hidden = !offline;
  };
  window.addEventListener('online', sync);
  window.addEventListener('offline', sync);
  sync();
}
