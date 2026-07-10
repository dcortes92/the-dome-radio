import { store } from './store.js';

const THEME_KEY = 'theme';

/** Apply light/dark via prototype `data-theme` (does not remount audio). */
export function applyTheme(mode) {
  const root = document.documentElement;
  const dark = mode === 'dark';
  if (dark) root.setAttribute('data-theme', 'dark');
  else root.removeAttribute('data-theme');
  store.set(THEME_KEY, dark ? 'dark' : 'light');
  syncDarkSwitch();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#121211' : '#1A1A1A');
}

export function getTheme() {
  const stored = store.get(THEME_KEY, null);
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function syncDarkSwitch() {
  const btn = document.getElementById('pfDark');
  if (!btn) return;
  btn.setAttribute(
    'aria-checked',
    document.documentElement.getAttribute('data-theme') === 'dark' ? 'true' : 'false',
  );
}

export function initTheme() {
  applyTheme(getTheme());
  const btn = document.getElementById('pfDark');
  if (!btn) return;
  btn.addEventListener('click', () => {
    applyTheme(getTheme() === 'dark' ? 'light' : 'dark');
  });
}
