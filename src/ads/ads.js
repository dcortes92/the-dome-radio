import { isPremium } from '../api/premium.js';

/**
 * @param {import('../api/premium.js').Profile | null} profile
 */
export function shouldShowAds(profile) {
  return !isPremium(profile);
}

let mounted = false;

/**
 * @param {Array<'dock' | 'explore-inline'>} slots
 */
export function mountAdSlots(slots) {
  if (!shouldShowAds(null) && !shouldShowAds(
    JSON.parse(localStorage.getItem('dome:profile') || 'null'),
  )) {
    /* still allow explicit mount when free */
  }
  const client = import.meta.env.VITE_ADSENSE_CLIENT_ID;
  slots.forEach((id) => {
    const el = document.querySelector(`[data-ad-slot="${id}"]`);
    if (!el) return;
    el.hidden = false;
    el.setAttribute('aria-hidden', 'false');
    if (!el.dataset.ready) {
      el.dataset.ready = '1';
      el.innerHTML = client
        ? `<ins class="adsbygoogle" style="display:block" data-ad-client="${client}" data-ad-slot="${id}"></ins>`
        : `<div class="ad-placeholder">Ad</div>`;
    }
  });
  if (client && !mounted) {
    mounted = true;
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
    s.crossOrigin = 'anonymous';
    s.onerror = () => {
      /* fail soft — never block playback */
    };
    document.head.appendChild(s);
  }
}

export function teardownAdSlots() {
  document.querySelectorAll('[data-ad-slot]').forEach((el) => {
    el.hidden = true;
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '';
    delete el.dataset.ready;
  });
}
