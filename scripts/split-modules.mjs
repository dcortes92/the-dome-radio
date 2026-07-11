#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const raw = fs.readFileSync(path.join(root, 'scripts/_extracted-app.js'), 'utf8');

const studioIdx = raw.indexOf('/* ════ studio ════ */');
const authIdx = raw.indexOf('/* ════ auth ════ */');
if (authIdx < 0 || studioIdx < 0) throw new Error('markers missing');

const beforeAuth = raw.slice(0, authIdx);
const authToStudio = raw.slice(authIdx, studioIdx);
const fromStudio = raw.slice(studioIdx);

// Strip Radio Browser block
let core = beforeAuth.replace(
  /\/\* =================== Radio Browser API =================== \*\/[\s\S]*?throw new Error\('All mirrors unreachable'\);\n\}\n\n/,
  '',
);

// Strip store object (keep favs/recents lines that follow)
core = core.replace(
  /\/\* persistent library \(safe storage wrapper\) \*\/\nconst store=\{[\s\S]*?\};\n/,
  '',
);

// Strip MediaSession functions (keep call site — we'll replace initMediaSession())
core = core.replace(
  /\/\* ── MediaSession:[\s\S]*?\nfunction initMediaSession\(\)\{[\s\S]*?\n\}\n\n/,
  '',
);

core = core.replace(/\ninitMediaSession\(\);\n\s*$/, '\n');

const storeJs = `/** localStorage wrapper — keys prefixed with dome: */
export const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem('dome:' + k);
      return v === null ? d : JSON.parse(v);
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem('dome:' + k, JSON.stringify(v));
    } catch {
      /* ignore */
    }
  },
};
`;

const radioJs = `const BASES = [
  'https://de1.api.radio-browser.info',
  'https://de2.api.radio-browser.info',
  'https://fi1.api.radio-browser.info',
  'https://at1.api.radio-browser.info',
];

let baseIdx = 0;

export async function api(path) {
  for (let i = 0; i < BASES.length; i++) {
    const b = BASES[(baseIdx + i) % BASES.length];
    try {
      const r = await fetch(b + path, { headers: { 'User-Agent': 'TheDome/1.0' } });
      if (!r.ok) throw new Error('bad status');
      baseIdx = (baseIdx + i) % BASES.length;
      return await r.json();
    } catch {
      /* next mirror */
    }
  }
  throw new Error('All mirrors unreachable');
}

export { BASES };
`;

const mediaJs = `export function updateMediaSession(st) {
  if (!('mediaSession' in navigator) || !st) return;
  const country = st.country || (st.countrycode ? st.countrycode : '');
  const sub = [country, st.codec ? st.codec.toUpperCase() : '', st.bitrate ? st.bitrate + 'kbps' : '']
    .filter(Boolean)
    .join(' · ');
  const art = [];
  if (st.favicon) {
    ['96x96', '128x128', '192x192', '256x256', '512x512'].forEach((sizes) =>
      art.push({ src: st.favicon, sizes, type: 'image/png' }),
    );
  }
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: st.name || 'Live radio',
      artist: sub || 'The Dome',
      album: 'The Dome · World Radio Atlas',
      artwork: art,
    });
  } catch {
    /* ignore */
  }
}

export function setMediaPlaybackState(playing) {
  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
    } catch {
      /* ignore */
    }
  }
}

export function initMediaSession(getHandlers) {
  if (!('mediaSession' in navigator)) return;
  const ms = navigator.mediaSession;
  const bind = (action, fn) => {
    try {
      ms.setActionHandler(action, fn);
    } catch {
      /* ignore */
    }
  };
  const h = typeof getHandlers === 'function' ? getHandlers() : getHandlers;
  bind('play', () => h.playPause());
  bind('pause', () => h.playPause());
  bind('previoustrack', () => h.prev());
  bind('nexttrack', () => h.next());
  bind('stop', () => h.stop());
}
`;

fs.writeFileSync(path.join(root, 'src/store.js'), storeJs);
fs.writeFileSync(path.join(root, 'src/api/radio-browser.js'), radioJs);
fs.writeFileSync(path.join(root, 'src/player/media-session.js'), mediaJs);

// Creator: studio + onair + hub — needs $, store, play, slimSt, esc, artHTML, api from window bridge
const creatorJs = `/**
 * Creator / Studio / On Air — frozen prototype (nav tab stays hidden).
 * Relies on window.__dome for shared helpers from the main app.
 */
export function initCreatorViews() {
  const { store, $, play, slimSt, esc, artHTML, api, audio } = window.__dome || {};
  if (!store || !$) return;

  ${fromStudio}
}
`;

fs.mkdirSync(path.join(root, 'src/views/creator'), { recursive: true });
// Creator IIFEs use bare $, store, etc. — better keep them in app.js for now and only move file as copy
// For isolation task: put fromStudio in creator/index.js as raw script that expects globals

fs.writeFileSync(
  path.join(root, 'src/views/creator/index.js'),
  `/** Frozen Creator/Studio/On-air prototype — loaded only when tab shown (hidden in v1). */
export function loadCreatorModules() {
  return import('./legacy.js');
}

export function initCreatorViews() {
  /* legacy IIFEs self-register window.initCreator */
}
`,
);

fs.writeFileSync(
  path.join(root, 'src/views/creator/legacy.js'),
  `/* eslint-disable */
/* Creator/Studio/On-air — uses globals from window.__dome set by main app */
const { store, $, play, slimSt, esc, artHTML, api, audio, flag } = window.__dome;

${fromStudio}
`,
);

const appJs = `import { store } from './store.js';
import { api } from './api/radio-browser.js';
import {
  updateMediaSession,
  setMediaPlaybackState,
  initMediaSession,
} from './player/media-session.js';

${core}

${authToStudio}

// Expose shared helpers for frozen creator module
window.__dome = {
  store,
  api,
  $,
  play,
  slimSt,
  esc,
  artHTML,
  audio,
  flag,
  state,
};

initMediaSession(() => ({
  playPause: () => playBtn && playBtn.click(),
  next: () => document.getElementById('nextBtn')?.click(),
  prev: () => document.getElementById('prevBtn')?.click(),
  stop: () => {
    audio.pause();
    state.playing = false;
    setMediaPlaybackState(false);
  },
}));

// Lazy-load creator only if tab ever un-hidden
export async function ensureCreator() {
  await import('./views/creator/legacy.js');
}

document.querySelectorAll('nav button[data-view="creator"]').forEach((b) => {
  b.addEventListener('click', () => ensureCreator(), { once: true });
});

export { state, play, store, api, $ };
`;

fs.writeFileSync(path.join(root, 'src/app.js'), appJs);
console.log('OK', {
  core: core.length,
  auth: authToStudio.length,
  creator: fromStudio.length,
  app: appJs.length,
});
