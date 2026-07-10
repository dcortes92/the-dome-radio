# Implementation Plan: The Dome Radio PWA

**Branch**: `001-dome-radio-pwa` | **Date**: 2026-07-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-dome-radio-pwa/spec.md`  
**Prior architecture notes**: Cursor plan `backend_and_ui_refactor_299314b5` (folded into research + this plan)  
**Constraint**: Keep costs at or near zero for now (free tiers; document first paid cliff)  
**Re-validated**: 2026-07-10 via `/speckit-plan` (React vs vanilla, PWA packaging, near-zero backend)

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Evolve the working Netlify-hosted HTML/JS radio atlas into a maintainable **PWA** with real **auth**, **cross-device favorites sync**, **display ads** for free listeners, a **Stripe subscription** that removes ads, and **Chromecast + AirPlay casting**.

**UI stack verdict**: Keep vanilla JS + CSS; **do not migrate to React in v1**. The prototype works; the problem is packaging (monolith + inlined assets), not the lack of a framework. Modularize with **Vite + ES modules**, extract ~700 KB base64 images, preserve PWA (`manifest` + `sw.js`).

**Backend verdict (near-zero $)**: **Supabase Free** (Auth + Postgres + RLS) for identity/favorites; **Netlify Functions** for Stripe Checkout/portal/webhook secrets; **Stripe** (pay-as-you-go); display ads for free tier. No custom always-on server. Creator/live broadcast stays frozen/hidden. First intentional paid cliff: Supabase Pro (~$25/mo) if Free inactivity pause hurts production.

**Current baseline (2026-07-10)**: Feature branch `001-dome-radio-pwa` has the Vite modular app plus Jul 2 prototype chrome (bottom `nav-pill`, header cast/search/avatar, neumorphic Now Playing, desktop frame locked at 412px). Speckit backend (Supabase/Stripe/ads/cast modules) is preserved. Use Node 20+ (`nvm use 22`).

## Technical Context

**Language/Version**: JavaScript (ES2022 modules); Node 20+ for Vite and Netlify Functions  
**Primary Dependencies**: Vite; `@supabase/supabase-js`; Stripe SDK (Functions); Google Cast Web Sender (CAF); Leaflet (existing CDN or bundled); optional Vitest + Playwright  
**Storage**: Supabase Postgres (`profiles`, `favorites`, `recents`) + client `localStorage` cache; IndexedDB only for frozen Creator prototype  
**Testing**: Vitest (unit, including cast session state); Playwright smoke for auth/favorites/ad gate; manual Chromecast + AirPlay + PWA install checks  
**Target Platform**: Modern mobile + desktop browsers; installable PWA (Netlify CDN); Cast from Chrome/Android; AirPlay from Safari/iOS where platform allows  
**Project Type**: Static web app (PWA) + serverless functions  
**Performance Goals**: Station select → audible start ≤3s median mobile (reachable stream); cast start ≤30s when target available (SC-006); warm PWA relaunch usable UI ≤3s; extract ~700KB base64 images to static assets; lazy-load Cast SDK; no CWV regression vs prototype without waiver  
**Constraints**: Near-zero $ ops (free tiers); no React rewrite in v1; no audio ad pre-roll / stream proxy; no Creator backend; client-direct Radio Browser; secrets only in Functions; AirPlay limited to Apple browser/OS surfaces  
**Scale/Scope**: Early audience (≪50k MAU); single Netlify site; one Supabase project; one Stripe product (monthly ± annual later); Cast Default Media Receiver first (optional static Custom Receiver later)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*  
*Source: `.specify/memory/constitution.md` (The Dome Constitution v1.0.0)*

- **I. Code Quality**: PASS — Modularize existing patterns (`store`, `api()`, `play()`); no speculative React rewrite; Creator isolated as dead-path hidden module; lint/format via Vite/ESLint when introduced.
- **II. Testing Standards**: PASS — Plan maps P1/P2 stories to Vitest + smoke E2E; critical paths (discovery, playback, favorites, ads/premium, cast UI states, PWA) covered; physical Chromecast/AirPlay primarily manual + CastContext mocks (see Complexity Tracking).
- **III. User Experience Consistency**: PASS — Preserve monochrome atlas UI; ads as intentional slots matching UI; auth prompts reuse existing sheets; cast status uses shared loading/empty/error/playing patterns; dark mode retained.
- **IV. Performance Requirements**: PASS — Targets in Technical Context + Spec NFRs; image extraction is primary weight win; ad + Cast scripts lazy-loaded; SW does not precache ads/API/Cast CDN.
- **Quality Gates**: No unjustified exceptions. Cast/AirPlay scope (stakeholder B) and platform limits documented in research and Complexity Tracking.

### Post-design re-check (Phase 1) — 2026-07-10

- Data model + contracts keep payment writes service-role-only (security).
- Cast/AirPlay client contract and optional static receiver documented; no paid cast SaaS.
- Quickstart defines measurable validation for perf, entitlement, and physical cast targets.
- Near-zero cost stack documented; Supabase Free pause recorded in Complexity Tracking (not a principle violation — explicit ops trade-off).
- Still PASS.

## Project Structure

### Documentation (this feature)

```text
specs/001-dome-radio-pwa/
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   └── interfaces.md    # Phase 1
└── tasks.md             # Phase 2 (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
index.html                 # Vite shell (markup only after refactor)
src/
  main.js                  # boot, tab routing
  api/
    radio-browser.js       # mirrors + failover
    supabase.js            # auth + sync client
    billing.js             # checkout / portal helpers
  ads/
    ads.js                 # slot mount + premium gate
  player/                  # play(), MediaSession, dial
  cast/                    # Cast Sender + AirPlay/remote playback helpers, session UI
  views/                   # explore, discover, search, library, profile
  views/creator/           # frozen prototype — hidden
  store.js                 # localStorage offline cache
  styles/
    main.css
public/
  assets/genres/           # extracted images
  cast-receiver/           # optional Custom Web Receiver (static) if Default Media Receiver insufficient
  sw.js
  manifest.json
  icons /
  ads.txt                  # when ad network approved
netlify/
  functions/
    create-checkout.js
    create-portal.js
    stripe-webhook.js
vite.config.js
netlify.toml               # build → dist + function routes
package.json
tests/
  unit/
  e2e/                     # optional Playwright
```

**Structure Decision**: Single static PWA at repo root with Vite `src/` and Netlify Functions under `netlify/functions/`. No separate `frontend/`/`backend/` apps — backend is BaaS (Supabase) + three Functions. Cast is client-side (Google CAF + platform AirPlay); optional static receiver under `public/cast-receiver/`.

## Complexity Tracking

| Violation / stretch | Why Needed | Simpler Alternative Rejected Because |
|---------------------|------------|--------------------------------------|
| Chromecast + AirPlay in v1 (new vs prototype) | Stakeholder chose B; Spec Story 6 / FR-010 | MediaSession-only fails external-device cast requirement |
| AirPlay only on Apple browser/OS surfaces | No free cross-browser AirPlay API | Third-party cast bridges add cost and complexity |
| Manual Cast/AirPlay device testing | Physical receivers hard to automate in CI | Skipping device tests would leave FR-010 unverified |
| Supabase Free inactivity pause | Near-zero cost requirement | Always-on Pro ($25/mo) rejected until traffic justifies it; document keep-alive / upgrade path |
| Creator code retained but hidden | Avoid big-bang delete during modularization | Immediate deletion risks losing future work; isolation is enough for v1 |

## Phased delivery (implementation foreshadow)

Aligned with prior Cursor plan; detailed tasks via `/speckit-tasks`:

1. **Modularize** — Vite, extract CSS/assets, ES modules, hide Creator, Netlify build to `dist`.
2. **Supabase** — schema/RLS, real auth, favorites/recents sync, local cache.
3. **Monetization** — ad slots + Stripe Checkout/portal/webhook + premium gate.
4. **Cast** — Google Cast Web Sender + AirPlay/remote playback in player dock; MediaSession retained; manual device QA.
5. **Polish** — tests, optional TS on new files, Custom Receiver only if needed, Creator later.
