import { secureAssetUrl } from '../api/radio-browser.js';

export function updateMediaSession(st) {
  if (!('mediaSession' in navigator) || !st) return;
  const country = st.country || (st.countrycode ? st.countrycode : '');
  const sub = [country, st.codec ? st.codec.toUpperCase() : '', st.bitrate ? st.bitrate + 'kbps' : '']
    .filter(Boolean)
    .join(' · ');
  const art = [];
  const icon = secureAssetUrl(st.favicon);
  if (icon) {
    ['96x96', '128x128', '192x192', '256x256', '512x512'].forEach((sizes) =>
      art.push({ src: icon, sizes, type: 'image/png' }),
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
