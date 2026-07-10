import './styles/main.css';
import { initTheme } from './theme.js';
import { initOfflineBanner } from './offline.js';
import { registerServiceWorker } from './pwa.js';
import { mountAdSlots, teardownAdSlots, shouldShowAds } from './ads/ads.js';
import { initSupabaseAuth } from './api/supabase.js';
import { createCastController } from './cast/cast-controller.js';
import { store } from './store.js';

async function boot() {
  // Boot core atlas UI (browse, play, map, library, prototype auth sheet)
  await import('./app.js');

  initTheme();
  initOfflineBanner();
  registerServiceWorker();

  const cast = createCastController({
    getStation: () => {
      const st = window.__dome?.state;
      if (st && st.idx >= 0) return st.list[st.idx];
      return null;
    },
    pauseLocal: () => {
      const audio = document.getElementById('audio');
      audio?.pause();
    },
  });
  const castBtn = document.getElementById('castBtn');
  if (castBtn) {
    castBtn.addEventListener('click', () => {
      cast.prompt().catch(() => {
        /* empty / unavailable — local play continues */
      });
    });
    cast.watchAvailability((available) => {
      castBtn.disabled = !available;
      castBtn.title = available ? 'Cast' : 'No cast targets available';
      castBtn.setAttribute('aria-disabled', String(!available));
    });
  }
  window.__domeCast = cast;

  function refreshAds() {
    const profile = store.get('profile', null);
    if (shouldShowAds(profile)) mountAdSlots(['dock', 'explore-inline']);
    else teardownAdSlots();
  }
  // Defer one frame so Explore markup is in the DOM after app.js boot
  requestAnimationFrame(refreshAds);

  initSupabaseAuth({ onProfile: refreshAds }).catch(() => {});

  document.getElementById('upgradeBtn')?.addEventListener('click', async () => {
    const { startCheckout } = await import('./api/billing.js');
    try {
      await startCheckout();
    } catch (e) {
      console.warn('Checkout unavailable', e);
    }
  });
  document.getElementById('manageSubBtn')?.addEventListener('click', async () => {
    const { openPortal } = await import('./api/billing.js');
    try {
      await openPortal();
    } catch (e) {
      console.warn('Portal unavailable', e);
    }
  });
}

boot().catch((err) => {
  console.error('Boot failed', err);
});
