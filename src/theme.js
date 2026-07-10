import { store } from './store.js';

const THEME_KEY = 'theme';

/** Apply light/dark appearance without remounting audio. */
export function applyTheme(mode) {
  const root = document.documentElement;
  const dark = mode === 'dark';
  root.classList.toggle('theme-dark', dark);
  document.body?.classList.toggle('theme-dark', dark);
  store.set(THEME_KEY, dark ? 'dark' : 'light');
}

export function getTheme() {
  return store.get(THEME_KEY, null) ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

export function initTheme() {
  applyTheme(getTheme());
  const btn = document.getElementById('themeToggle');
  if (btn) {
    btn.addEventListener('click', () => {
      applyTheme(getTheme() === 'dark' ? 'light' : 'dark');
    });
  }
}
