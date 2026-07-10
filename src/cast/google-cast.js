/** Google Cast Web Sender (CAF) — lazy-loaded. */

let frameworkReady = null;

function loadCastSdk() {
  if (frameworkReady) return frameworkReady;
  frameworkReady = new Promise((resolve) => {
    window.__onGCastApiAvailable = (isAvailable) => {
      resolve(!!isAvailable && window.cast?.framework);
    };
    if (window.cast?.framework) {
      resolve(true);
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
    s.async = true;
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
  return frameworkReady;
}

export function createGoogleCast({ onState } = {}) {
  let ctx = null;

  async function ensure() {
    const ok = await loadCastSdk();
    if (!ok || !window.cast?.framework) return null;
    ctx = window.cast.framework.CastContext.getInstance();
    ctx.setOptions({
      receiverApplicationId: window.chrome?.cast?.media?.DEFAULT_MEDIA_RECEIVER_APP_ID,
      autoJoinPolicy: window.chrome?.cast?.AutoJoinPolicy?.ORIGIN_SCOPED,
    });
    return ctx;
  }

  return {
    async available() {
      const c = await ensure();
      if (!c) return false;
      try {
        const state = c.getCastState();
        onState?.({ available: state !== 'NO_DEVICES_AVAILABLE' });
        return state !== 'NO_DEVICES_AVAILABLE';
      } catch {
        return false;
      }
    },
    async requestSession(station) {
      const c = await ensure();
      if (!c) throw new Error('Cast unavailable');
      await c.requestSession();
      if (station) await this.loadMedia(station);
    },
    async loadMedia(station) {
      const c = await ensure();
      const session = c?.getCurrentSession();
      if (!session || !station) return;
      const url = station.url_resolved || station.url;
      const mediaInfo = new window.chrome.cast.media.MediaInfo(url, 'audio/mpeg');
      mediaInfo.metadata = new window.chrome.cast.media.MusicTrackMediaMetadata();
      mediaInfo.metadata.title = station.name || 'Live radio';
      mediaInfo.streamType = window.chrome.cast.media.StreamType.LIVE;
      const req = new window.chrome.cast.media.LoadRequest(mediaInfo);
      await session.loadMedia(req);
    },
    async endSession() {
      const c = await ensure();
      c?.endCurrentSession(true);
    },
  };
}
