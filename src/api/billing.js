/** Client helpers for Stripe Checkout / Customer Portal via Netlify Functions. */

async function postJson(path, body = {}) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

export async function startCheckout(priceId = import.meta.env.VITE_STRIPE_PRICE_ID) {
  const { url } = await postJson('/api/create-checkout', { priceId });
  if (url) window.location.href = url;
  return url;
}

export async function openPortal() {
  const { url } = await postJson('/api/create-portal', {});
  if (url) window.location.href = url;
  return url;
}
