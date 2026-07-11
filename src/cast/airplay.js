/** AirPlay / Remote Playback helpers for Safari / iOS. */

export function createAirPlay({ mediaEl } = {}) {
  return {
    async available() {
      const el = typeof mediaEl === 'function' ? mediaEl() : mediaEl;
      if (!el) return false;
      // WebKit AirPlay
      if (el.webkitSupportsPresentationMode) return true;
      if (el.disableRemotePlayback === false || 'remote' in el) return true;
      // Heuristic: Safari on Apple OS
      const ua = navigator.userAgent;
      return /Safari/.test(ua) && !/Chrome|CriOS|Edg/.test(ua);
    },
    async prompt() {
      const el = typeof mediaEl === 'function' ? mediaEl() : mediaEl;
      if (!el) throw new Error('No media element');
      if (el.webkitShowPlaybackTargetPicker) {
        el.webkitShowPlaybackTargetPicker();
        return;
      }
      if (el.remote?.prompt) {
        await el.remote.prompt();
        return;
      }
      throw new Error('AirPlay not available in this browser');
    },
  };
}
