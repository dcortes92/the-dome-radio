# Quickstart: Validate The Dome Radio PWA plan

**Date**: 2026-07-09  
**Artifacts**: [plan.md](./plan.md) · [data-model.md](./data-model.md) · [contracts/interfaces.md](./contracts/interfaces.md)

This guide is for **post-implementation** validation. It is not the implementation itself (`/speckit-tasks` + implement).

## Prerequisites

- Node.js 20+ and npm
- Netlify account (existing site OK) + Netlify CLI optional
- Supabase Free project (Auth + Postgres)
- Stripe test mode account
- Ad network account optional for real creatives; use stub slots in dev

## Local setup (target after Phase 1+)

```bash
# from repo root
npm install
cp .env.example .env.local   # fill VITE_SUPABASE_*, VITE_STRIPE_*, ad client id
npm run dev                  # Vite; confirm #skip / SW bypass still works if present
```

Netlify Functions locally:

```bash
npx netlify dev
```

## Environment checklist

| Variable | Where | Purpose |
|----------|-------|---------|
| `VITE_SUPABASE_URL` | Client | Auth + data |
| `VITE_SUPABASE_ANON_KEY` | Client | RLS-scoped access |
| `SUPABASE_SERVICE_ROLE_KEY` | Netlify Functions only | Webhook profile updates |
| `STRIPE_SECRET_KEY` | Functions | Checkout / portal |
| `STRIPE_WEBHOOK_SECRET` | Functions | Verify events |
| `STRIPE_PRICE_ID` | Functions | Subscription price |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Client | Optional Stripe.js |
| `VITE_ADSENSE_CLIENT_ID` | Client | Ads (or stub) |

## Validation scenarios

### V1 — Guest listen (P1)

1. Open app signed out.
2. Browse stations; start playback on a reachable stream.
3. **Expect**: Audio within ~3s (NFR-PERF-001); no auth wall; ads slots visible (or stub).
4. On an HTTPS deploy: DevTools Network / security panel shows no mixed-content image requests for station favicons (NFR-SEC-001); broken icons fall back to initials.
5. Play a station whose stream is already HTTPS (or supports TLS on the same host): page should stay fully secure while audio plays.
6. Play an HTTP-only station if available: audio may still start after HTTPS attempt fails; browser mixed-content warning on that path is expected without a stream proxy.

### V2 — PWA shell (P1)

1. Lighthouse / browser install prompt on supported device.
2. Install; relaunch; go offline and reload.
3. **Expect**: Shell loads; streaming shows clear offline/error; online play works.

### V3 — Auth + favorites (P2)

1. Register / sign in (Supabase).
2. Favorite 2 stations; refresh; sign out; sign in on another browser profile if possible.
3. **Expect**: Favorites persist; guest favorite prompts auth (FR-006).

### V4 — Ads vs premium (P2)

1. As guest/free user: confirm dock + explore slots mount.
2. Stripe test Checkout → webhook updates profile → refresh session.
3. **Expect**: `isPremium` true; slots torn down; no ad script.
4. Cancel via Customer Portal; after `premium_until`, ads return.

### V5 — Cast to external device (P2)

1. **Chromecast**: On Chrome/Android with a Cast device on the LAN, play a station → open cast control → choose device.
2. **Expect**: Audio on the Cast device within 30s (SC-006); local player shows casting status; station switch updates remote or shows clear reconnect messaging; stop/disconnect restores local playback (FR-012).
3. **AirPlay**: On Safari/iOS with an AirPlay target, use the route/cast control.
4. **Expect**: Audio on the AirPlay target; same disconnect/local-restore rules.
5. **Unavailable**: With no targets, cast UI shows empty/unavailable without breaking local play.
6. **MediaSession** (complementary): Lock-screen / headset controls still work for *local* playback; they do not replace V5.

### V6 — Dark mode (P3)

1. Toggle appearance during playback.
2. **Expect**: Theme changes without stopping audio (SC-008).

## Cost / ops smoke

- Confirm Supabase project stays active under normal use (watch Free **inactivity pause**).
- Confirm Netlify deploy publishes `dist` + functions; secrets not in client bundle (`grep` build for `service_role`).

## Automated tests (when present)

```bash
npm test           # Vitest: isPremium, sync merge, api failover
npm run test:e2e   # Playwright smoke if configured
```

Map suites to Spec NFR-TEST-001 / NFR-TEST-002.

## Done when

All V1–V6 scenarios pass against a Netlify preview or local `netlify dev`, and constitution quality gates in [plan.md](./plan.md) remain green.

## Implementation notes (2026-07-09)

- Vite build verified (`npm run build` → `dist/`).
- Unit tests: `npm test` (20 passing).
- Supabase Free inactivity pause: keep the project warm with real traffic or upgrade to Pro (~$25/mo) for always-on production.
- Cast/AirPlay: run manual V5 checklist on physical devices before release.
- Station-select → audible start: measure on a median mobile network and record here when available (target ≤3s).
