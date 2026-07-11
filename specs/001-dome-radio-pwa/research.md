# Research: The Dome Radio PWA

**Date**: 2026-07-10 (re-validated; originally 2026-07-09)  
**Spec**: [spec.md](./spec.md)  
**Prior input**: Cursor plan `backend_and_ui_refactor_299314b5` + near-zero cost constraint + stakeholder ask “is React worth it?”

## Decision 1: Keep vanilla JS + Vite; do not migrate to React (v1)

**Decision**: Modularize the existing HTML/CSS/JS prototype with Vite and ES modules. Do **not** rewrite in React/Vue/Svelte for this release. The app **is / remains a PWA** via `manifest.json` + service worker — framework choice is orthogonal to installability.

**Rationale**:
- The prototype already works and is deployed on Netlify; user value is auth, sync, ads, and paid ad-free — not a framework swap.
- The UI is DOM-heavy (Leaflet map, canvas genre graph, rotary dial, MediaSession). A React rewrite would re-implement the same DOM work with high regression risk and weeks of effort — poor fit for a near-zero-cost, improve-what-works mandate.
- Vite gives a real build (env vars, asset hashing, module split) while preserving behavior and PWA shell.
- Constitution I (code quality) is better served by extracting modules than by introducing a second paradigm mid-flight.

**Alternatives considered**:
| Option | Why rejected for v1 |
|--------|---------------------|
| Full React/Next rewrite | Multi-week rewrite, little listener-visible benefit, higher cost/time |
| Preact / lit | Still a rewrite of interaction model; same risk, less ecosystem payoff |
| Stay on single `index.html` forever | Unmaintainable (~3k lines, ~700 KB inlined images); blocks env-based secrets and clean Netlify Functions |

**When React becomes worth it**: New multi-screen product surfaces (Creator live broadcast, complex account billing UI, design-system reuse across apps) or a team that already ships React daily. Revisit after Creator is in scope.

---

## Decision 2: Near-zero cost stack

**Decision**: Netlify (static + Functions) + Supabase Free (Auth + Postgres + RLS) + Stripe (no platform fee) + display ads (AdSense or equivalent). Stay on free tiers until traffic or uptime needs force a paid jump.

**Rationale**:
- Matches the working Netlify deploy and the prior architecture plan.
- Stripe charges only on successful payments (no monthly platform fee).
- Supabase Free: 2 projects, 50k MAU, 500 MB DB, unlimited API requests — enough for early listeners.
- Ads monetize free users without requiring a paid backend.

**Cost reality check (honest)**:

| Service | Near-zero mode | First paid cliff |
|---------|----------------|------------------|
| Netlify | Free static + limited Functions | Bandwidth / function usage |
| Supabase | Free project | **Pro ~$25/mo** when Free inactivity pause or limits hurt production |
| Stripe | $0 until first paid subscriber | % + fixed fee per charge |
| Ads | $0 until approved; revenue share | N/A |

**Critical Free-tier constraint**: Supabase Free projects **pause after ~7 days of inactivity**. For a public always-on product this is unacceptable long-term. Mitigations for v1:
1. Prefer a single always-used project (prod) so real traffic keeps it warm.
2. Optional lightweight keep-alive (scheduled Netlify Function pinging a health endpoint) only if needed during quiet periods — document as a temporary hack.
3. Budget Pro ($25/mo) as the first intentional cost when the product must not pause.

**Alternatives considered**:
| Option | Why not primary |
|--------|-----------------|
| Firebase Spark | Viable; weaker Postgres/RLS story for favorites sync |
| Neon + Clerk + Netlify | More moving parts; Clerk free tier is fine but splits auth/DB |
| Cloudflare Pages + D1 + Workers | Excellent cost profile; larger rewrite of auth/sync patterns vs Supabase |
| Self-hosted Postgres | Ops cost (time) violates near-zero *effort* |

---

## Decision 3: Auth + sync = Supabase; payments = Stripe via Netlify Functions

**Decision**: Replace fake `localStorage` auth with Supabase Auth. Persist favorites (and recents as a sync bonus aligned with the prototype) under RLS. Stripe Checkout + Customer Portal + webhook update `profiles.subscription_status`. Client never holds service-role or Stripe secret keys.

**Rationale**:
- Spec FR-004–FR-009 need real identity, durable favorites, and paid entitlement.
- RLS keeps per-user data secure without a custom API server.
- Netlify Functions are the minimal place for webhook signature verification and Checkout session creation.

**Guest favorites (spec FR-006)**: Guests who favorite are prompted to sign in; local-only guest favorites may remain as a soft cache but are not account-backed until registration. On first login, optional merge of local favorites into the account (server-wins on conflicts) — document in data-model.

---

## Decision 4: Ads = non-interruptive display; premium = ad-free only

**Decision**: Display slots (dock banner + one explore inline). No audio pre-roll, no stream proxy, no interstitials on play. Paid entitlement removes ads only (FR-009).

**Rationale**:
- Spec and prior plan agree; audio-first UX must not break station compatibility.
- AdSense (or similar) fits a static PWA; apply early (approval risk for streaming apps).
- Lazy-load ad scripts after first paint; hide slots when `isPremium`.

**Alternatives considered**: Audio pre-roll (needs proxy — out of scope, hurts CORS/stream compatibility); gating sync behind paywall (rejected by product — sync stays free for registered users).

---

## Decision 5: Cast in v1 = Chromecast + AirPlay (MediaSession stays complementary)

**Decision**: User Story 6 requires sending the **current station stream to an external playback device**. v1 implements:

| Path | Mechanism | Cost |
|------|-----------|------|
| **Chromecast / Cast-enabled TVs** | Google Cast Web Sender (CAF) in the PWA; load station stream URL on the receiver | $0 SDK; optional static Custom Web Receiver on Netlify if Default Media Receiver is insufficient |
| **AirPlay** | Safari / iOS / iPadOS native route via HTML media + Remote Playback / system AirPlay controls where the platform exposes them | $0 (platform-native; no AirPlay SDK for non-Apple browsers) |
| **MediaSession** | Keep existing lock-screen / headset controls | Complementary — **does not** satisfy Story 6 alone |

**Stakeholder confirmation (2026-07-09)**: Option **B** — Chromecast/AirPlay in scope (not MediaSession-only).

**Rationale**:
- Spec FR-010 / SC-006 describe external cast targets, empty-state when none available, and station switch during cast — that is Cast/AirPlay UX, not lock-screen remotes.
- Prototype has MediaSession only today; cast is **new work**, not a preserve-existing path.
- Both Cast Sender and AirPlay-via-media are free; no new paid SaaS.

**Implementation notes**:
1. Lazy-load Cast Sender SDK on first cast intent (do not block first paint).
2. Prefer **Default Media Receiver** with the station’s public stream URL for v1; fall back to a tiny Netlify-hosted Custom Web Receiver only if branding or stream quirks require it.
3. On cast start: pause or duck local `<audio>` and show clear “Casting to …” status; on disconnect, restore local play/stop per FR-012.
4. Station change while casting: `loadMedia` / equivalent with new stream URL, or show reconnect messaging if the session cannot follow.
5. AirPlay: ensure the playing media element is AirPlay-capable on Apple browsers; surface a cast/route control in the player dock; document that AirPlay is **not** available from Chrome-on-Windows (empty/unavailable state is OK — FR-010 “when available”).
6. CORS / non-HTTPS / exotic stream formats may fail on some receivers — treat as station-unreachable-on-cast with clear error; local playback remains usable.

**Alternatives considered**:
| Option | Why rejected |
|--------|----------------|
| MediaSession-only | Stakeholder chose B; does not meet external-device cast |
| Third-party cast SaaS | Unnecessary cost vs free Cast SDK + native AirPlay |
| Full custom receiver + DRM stack | Overkill for open radio streams in v1 |

---

## Decision 6: Creator / Studio / live broadcast out of scope

**Decision**: Isolate Creator-related code under `src/views/creator/` during modularization; keep the nav tab **hidden**. No LiveKit, no server-side broadcast, no tape sync.

**Rationale**: Spec and prior plan exclude it; reduces cost and scope while preserving code for a later initiative.

---

## Decision 7: Radio Browser stays client-direct

**Decision**: Keep calling Radio Browser mirrors from the client with existing failover. No proxy in v1. Upgrade station **favicon** URLs from `http://` (and protocol-relative `//`) to `https://` before rendering or persisting snapshots so the HTTPS PWA does not load mixed-content images (NFR-SEC-001). For **streams**, try an HTTPS rewrite first via `streamPlayCandidates`; if that fails, fall back once to the original HTTP URL so HTTP-only icy/mp3 servers still play. Do **not** run a Dome-owned HTTPS stream proxy in v1 (bandwidth / free-tier cost).

**Rationale**: Zero backend cost; works in the prototype. Favicon HTTPS upgrade removes browse-time mixed content. Stream HTTPS-first reduces “not secure” on play when the station supports TLS; HTTP fallback preserves reachability knowing Brave/Chrome may warn on that path only. Add a Netlify proxy later only if mirrors/CORS become unreliable or product requires a secure lock for every station.

---

## Decision 8: Testing approach

**Decision**: Vitest for pure modules (`api` failover, `isPremium`, sync merge, store, cast session state machine). Playwright smoke for browse → play, auth gate on favorites, ad vs premium visibility, PWA install where CI allows. Cast/AirPlay and MediaSession require **manual device checklist** (Chromecast + Apple AirPlay target); automate UI empty-state and mock CastContext where possible.

**Rationale**: Constitution II requires automated coverage for P1/P2 acceptance; full E2E of live streams is flaky — prefer contract/unit for logic and thin E2E for UI gates.

---

## Decision 9: PWA packaging

**Decision**: Preserve `manifest.json` + `sw.js` network-first navigation / cache-first same-origin static pattern. After Vite, update shell precache paths to `dist` assets; do not precache ad, Radio Browser, or Cast CDN origins.

**Rationale**: Spec Story 2; existing SW already correct for Netlify deploys.

---

## Resolved Technical Context

| Item | Resolution |
|------|------------|
| Language | JavaScript (ES modules); optional TypeScript later on new modules only |
| Build | Vite |
| Hosting | Netlify static + Functions |
| Auth/DB | Supabase Free (Auth + Postgres + RLS) |
| Payments | Stripe Billing + Netlify webhook/checkout/portal functions |
| Ads | Display network (AdSense or backup); premium gate in client |
| Cast | Google Cast Web Sender + AirPlay where platform allows; MediaSession complementary |
| Catalog | Radio Browser API (client) |
| UI framework | None (vanilla); not React |
| Cost posture | Free tiers first; document Supabase pause risk; Pro as first paid step |
