import { isPremium } from '../api/premium.js';
import { store } from '../store.js';

/**
 * @param {import('../api/premium.js').Profile | null} profile
 */
export function shouldShowAds(profile) {
  return !isPremium(profile);
}

let mounted = false;

function syncAppAdsClass(on) {
  document.getElementById('app')?.classList.toggle('has-ads', !!on);
}

/**
 * @param {Array<'dock' | 'explore-inline'>} slots
 */
export function mountAdSlots(slots) {
  const profile = store.get('profile', null);
  if (!shouldShowAds(profile)) {
    teardownAdSlots();
    return;
  }

  const client = import.meta.env.VITE_ADSENSE_CLIENT_ID;
  let any = false;
  slots.forEach((id) => {
    const el = document.querySelector(`[data-ad-slot="${id}"]`);
    if (!el) return;
    any = true;
    el.hidden = false;
    el.classList.add('is-mounted');
    el.setAttribute('aria-hidden', 'false');
    if (!el.dataset.ready) {
      el.dataset.ready = '1';
      el.innerHTML = client
        ? `<ins class="adsbygoogle" style="display:block" data-ad-client="${client}" data-ad-slot="${id}"></ins>`
        : `<div class="ad-placeholder" role="presentation">Ad</div>`;
    }
  });
  syncAppAdsClass(any);

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
    el.classList.remove('is-mounted');
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '';
    delete el.dataset.ready;
  });
  syncAppAdsClass(false);
  mounted = false;
}
