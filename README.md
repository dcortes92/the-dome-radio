# The Dome — World Radio Atlas

A monochrome world radio atlas you can install as a PWA. Browse stations by map, genre, and decade, then tune live streams without creating an account.

**Status:** Working prototype on Netlify. Spec Kit docs under [`specs/001-dome-radio-pwa/`](specs/001-dome-radio-pwa/) define the next architecture (modular Vite app, Supabase auth/sync, ads + Stripe ad-free, Chromecast & AirPlay).

## What’s in the prototype today

- Guest listening via [Radio Browser](https://www.radio-browser.info/) mirrors
- Explore / discover / search / library surfaces and a bottom player dock
- PWA shell (`manifest.json` + service worker)
- Dark appearance and MediaSession (lock screen / headset) controls
- Local-only “auth” and favorites (to be replaced with real backend)

Creator / Studio broadcast UI exists in the prototype but is **out of scope** for the current plan (kept hidden during the refactor).

## Planned direction

| Layer | Choice |
|-------|--------|
| App | Vanilla JS + Vite modules (no React rewrite for v1) |
| Hosting | Netlify (static + Functions) |
| Auth & sync | Supabase (Auth, Postgres, RLS) |
| Monetization | Display ads for free users; Stripe subscription = ad-free |
| Cast | Google Cast + AirPlay where the platform allows |

Near-zero cost is intentional: free tiers first; see the [plan](specs/001-dome-radio-pwa/plan.md) for the Supabase Free inactivity caveat.

## Spec Kit docs

| Doc | Purpose |
|-----|---------|
| [spec.md](specs/001-dome-radio-pwa/spec.md) | Product requirements & user stories |
| [plan.md](specs/001-dome-radio-pwa/plan.md) | Architecture & tech decisions |
| [research.md](specs/001-dome-radio-pwa/research.md) | Decision log |
| [data-model.md](specs/001-dome-radio-pwa/data-model.md) | Supabase entities |
| [contracts/](specs/001-dome-radio-pwa/contracts/) | Client ↔ backend interfaces |
| [tasks.md](specs/001-dome-radio-pwa/tasks.md) | Implementation checklist |
| [quickstart.md](specs/001-dome-radio-pwa/quickstart.md) | Post-build validation scenarios |

Project principles live in [`.specify/memory/constitution.md`](.specify/memory/constitution.md).

## Local development

```bash
nvm use 22   # Node 20+ required
npm install
npm run dev          # http://localhost:5173 — append #skip to bypass auth sheet
npm test             # Vitest unit tests
npm run build        # output in dist/
npm run preview      # preview production build
```

Copy `.env.example` to `.env.local` and fill Supabase / Stripe / AdSense values when ready. Netlify Functions need the non-`VITE_` secrets set in the Netlify UI.

Apply the SQL in [`supabase/migrations/001_init.sql`](supabase/migrations/001_init.sql) to your Supabase project before enabling real auth sync.

## License

Proprietary / TBD — add a license file when the project is ready to publish terms.
