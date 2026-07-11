/**
 * Cast session controller — Google Cast + AirPlay where available.
 * @typedef {'cast' | 'airplay' | 'none'} CastProvider
 * @typedef {'idle' | 'connecting' | 'connected' | 'error'} CastState
 */

import { createGoogleCast } from './google-cast.js';
import { createAirPlay } from './airplay.js';

export function createCastController(opts = {}) {
  /** @type {{ provider: CastProvider, state: CastState, deviceName?: string }} */
  let snap = { provider: 'none', state: 'idle' };
  const listeners = new Set();

  const google = createGoogleCast({
    onState: (s) => {
      snap = { ...snap, ...s };
      listeners.forEach((fn) => fn(!!(s.available ?? snap.state !== 'idle')));
    },
  });
  const airplay = createAirPlay({
    mediaEl: () => document.getElementById('audio'),
  });

  return {
    watchAvailability(cb) {
      listeners.add(cb);
      Promise.all([google.available(), airplay.available()]).then(([g, a]) => cb(g || a));
      return () => listeners.delete(cb);
    },
    async prompt() {
      const g = await google.available();
      if (g) {
        snap = { provider: 'cast', state: 'connecting' };
        await google.requestSession(opts.getStation?.());
        snap = { provider: 'cast', state: 'connected' };
        opts.pauseLocal?.();
        return;
      }
      const a = await airplay.available();
      if (a) {
        snap = { provider: 'airplay', state: 'connecting' };
        await airplay.prompt();
        snap = { provider: 'airplay', state: 'connected' };
        return;
      }
      snap = { provider: 'none', state: 'idle' };
      throw new Error('No cast targets available');
    },
    async start(station, provider) {
      if (provider === 'airplay') {
        await airplay.prompt();
        snap = { provider: 'airplay', state: 'connected' };
        return;
      }
      await google.requestSession(station);
      snap = { provider: 'cast', state: 'connected' };
      opts.pauseLocal?.();
    },
    async loadStation(station) {
      if (snap.provider === 'cast') await google.loadMedia(station);
      // AirPlay follows the media element src when we update audio
    },
    async stop() {
      if (snap.provider === 'cast') await google.endSession();
      snap = { provider: 'none', state: 'idle' };
      opts.resumeLocal?.();
    },
    getState() {
      return { ...snap };
    },
  };
}
