# Tasks: The Dome Radio PWA

**Input**: Design documents from `/specs/001-dome-radio-pwa/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Per The Dome Constitution (II. Testing Standards), test tasks are REQUIRED for user-observable behavior. Map each acceptance scenario to automated coverage. Write tests to fail first when practicable; critical paths (discovery, playback, map, PWA when in scope) MUST have regression tasks. Physical Chromecast/AirPlay remain manual checklists (plan Complexity Tracking).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

**Constitution alignment**: Include tasks that satisfy Quality Gates — lint/format, UX consistency checks, and performance verification where the plan defines targets (principles I–IV).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Single project at repository root: `src/`, `public/`, `netlify/functions/`, `tests/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Vite project initialization, tooling, and target directory layout without changing listener behavior yet

- [x] T001 Create `package.json` with Vite, Vitest, and Playwright scripts at repository root
- [x] T002 [P] Add `vite.config.js` with `root`, `publicDir`, `build.outDir` (`dist`), and Netlify-friendly asset base
- [x] T003 [P] Add ESLint + Prettier config (`.eslintrc.cjs`, `.prettierrc`) for `src/` and `netlify/functions/`
- [x] T004 [P] Create `.env.example` documenting `VITE_SUPABASE_*`, `VITE_STRIPE_*`, `VITE_ADSENSE_*`, and function-only secrets
- [x] T005 Create directory scaffolding: `src/api/`, `src/ads/`, `src/player/`, `src/cast/`, `src/views/`, `src/views/creator/`, `src/styles/`, `public/assets/genres/`, `netlify/functions/`, `tests/unit/`, `tests/e2e/`
- [x] T006 [P] Add `.gitignore` entries for `node_modules/`, `dist/`, `.env*`, Playwright report dirs
- [x] T007 Update `netlify.toml` with Vite build command, `publish = "dist"`, and functions directory `netlify/functions`

**Checkpoint**: `npm install` succeeds; empty Vite app can build (behavior migration starts in Phase 2)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Behavior-preserving modularization of the prototype so all user stories build on ES modules + PWA shell + shared store/player/API

**⚠️ CRITICAL**: No user story feature work (auth, ads, Stripe, Cast) should begin until this phase preserves guest browse/play

- [x] T008 Extract inline CSS from `index.html` into `src/styles/main.css` and link via Vite entry
- [x] T009 Extract base64 genre images from `index.html` into `public/assets/genres/` and replace with URL references
- [x] T010 Move `store` helpers into `src/store.js` preserving `dome:` localStorage keys
- [x] T011 [P] Move Radio Browser `api()` failover into `src/api/radio-browser.js`
- [x] T012 [P] Move playback, dial, and MediaSession into `src/player/` (`play.js`, `media-session.js`, `dial.js` as needed)
- [x] T013 Split primary views into `src/views/` (`explore.js`, `discover.js`, `search.js`, `library.js`, `profile.js`) wired from `src/main.js`
- [x] T014 Isolate Creator/Studio into `src/views/creator/` and keep Creator nav tab `hidden` in `index.html`
- [x] T015 Slim `index.html` to shell markup + Vite entry script; boot app from `src/main.js`
- [x] T016 Move `sw.js` and `manifest.json` under `public/`; update shell precache paths for Vite `dist` assets
- [x] T017 Verify `#skip` (or equivalent) SW bypass still works in `src/main.js` / `public/sw.js` for local dev
- [x] T018 [P] Add Vitest config in `vite.config.js` (or `vitest.config.js`) with `tests/unit/` include pattern
- [x] T019 [P] Add Playwright config `playwright.config.js` with baseURL for Vite preview
- [x] T020 Run production build (`npm run build`) and confirm Netlify-ready `dist/` includes icons, manifest, SW

**Checkpoint**: Guest can browse and play on Vite dev/preview with parity to prototype core listening; Creator remains hidden

---

## Phase 3: User Story 1 - Stream a station as a guest (Priority: P1) 🎯 MVP

**Goal**: Signed-out visitors browse stations and control live audio without any account prompt

**Independent Test**: Open app signed out → select station → hear audio; pause/switch works; unreachable stream shows recoverable error

### Tests for User Story 1 (REQUIRED) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation where practicable**

- [x] T021 [P] [US1] Unit test Radio Browser mirror failover in `tests/unit/radio-browser.test.js`
- [x] T022 [P] [US1] Unit test playback state machine (loading/playing/paused/error) in `tests/unit/player-state.test.js`
- [x] T023 [US1] Playwright smoke: guest browse → play without auth wall in `tests/e2e/guest-play.spec.js`

### Implementation for User Story 1

- [x] T024 [US1] Ensure guest boot path in `src/main.js` never blocks on auth before browse/play
- [x] T025 [US1] Wire explore/discover/search station selection to `src/player/play.js` with clear loading/playing/error UI states in `src/styles/main.css`
- [x] T026 [US1] Handle unreachable stream URLs with recoverable error (no stuck “playing”) in `src/player/play.js`
- [x] T027 [US1] Preserve MediaSession metadata/controls for local playback in `src/player/media-session.js`
- [x] T028 [US1] Confirm guest network blip shows recoverable offline/buffering messaging per FR-013 in player UI (`src/player/`, `src/views/`)

**Checkpoint**: US1 independently testable — MVP listening works

---

## Phase 4: User Story 2 - Install and use as a PWA (Priority: P1)

**Goal**: Installable app with offline-aware shell; live audio still requires connectivity

**Independent Test**: Install → relaunch → browse UI loads; offline open shows clear non-blank shell; online stream still works

### Tests for User Story 2 (REQUIRED) ⚠️

- [x] T029 [P] [US2] Unit test SW shell URL list / version helper if extracted in `tests/unit/sw-shell.test.js`
- [x] T030 [US2] Playwright (or manual checklist doc) PWA install/launch smoke notes in `tests/e2e/pwa-install.spec.js` (skip in CI without browser install support; assert manifest link + SW registration in page)

### Implementation for User Story 2

- [x] T031 [US2] Finalize `public/manifest.json` (name, icons, `display`, `start_url`, theme) for Vite-published paths
- [x] T032 [US2] Update `public/sw.js` network-first navigate + cache-first same-origin; pass-through cross-origin (ads/Radio Browser/Cast CDN)
- [x] T033 [US2] Register service worker from `src/main.js` only in production (or with `#skip` bypass)
- [x] T034 [US2] Add clear offline/connectivity UI for streaming failure in `src/views/` + `src/styles/main.css` (not blank shell)
- [x] T035 [US2] Measure warm relaunch / Lighthouse PWA basics and record notes under `specs/001-dome-radio-pwa/quickstart.md` validation section

**Checkpoint**: US2 independently testable — install + offline shell OK

---

## Phase 5: User Story 3 - Register, sign in, and manage favorites (Priority: P2)

**Goal**: Real Supabase auth; account-backed favorites sync; guests prompted before account favorite

**Independent Test**: Register → favorite → persist across refresh/session; guest favorite opens auth; sign out returns to guest listen

### Tests for User Story 3 (REQUIRED) ⚠️

- [x] T036 [P] [US3] Unit test favorites merge / server-wins sync in `tests/unit/favorites-sync.test.js`
- [x] T037 [P] [US3] Unit test guest favorite gate (must prompt auth) in `tests/unit/favorites-gate.test.js`
- [x] T038 [US3] Playwright: register/sign-in/favorite/unfavorite/sign-out flow in `tests/e2e/auth-favorites.spec.js` (Supabase test project or mocked client)

### Implementation for User Story 3

- [x] T039 [US3] Create Supabase SQL migration for `profiles`, `favorites`, `recents`, RLS, and auth trigger in `supabase/migrations/001_init.sql` (or `specs/001-dome-radio-pwa/contracts/`-aligned schema file committed at `supabase/migrations/001_init.sql`)
- [x] T040 [P] [US3] Implement Supabase client wrapper in `src/api/supabase.js` (`signUp`, `signInWithPassword`, `signOut`, `onAuthStateChange`)
- [x] T041 [US3] Replace fake auth IIFE with real auth UI wired in `src/views/profile.js` (and auth sheet markup in `index.html`)
- [x] T042 [US3] Implement favorites list/add/remove against Supabase per `contracts/interfaces.md` in `src/api/supabase.js` + `src/views/library.js`
- [x] T043 [US3] On login pull favorites/recents/profile into `src/store.js` (server-wins); write-through on fav toggle
- [x] T044 [US3] Guest favorite attempt opens sign-in/register prompt (FR-006) in `src/views/` / player chrome
- [x] T045 [US3] Implement recents upsert + trim-to-12 for signed-in users in `src/api/supabase.js` + `src/player/play.js`
- [x] T046 [US3] Ensure `profiles` payment columns are not client-writable; only `display_name` / `avatar_url` patches from client in `src/api/supabase.js`

**Checkpoint**: US3 independently testable — auth + favorites sync works

---

## Phase 6: User Story 4 - Ads for free listeners (Priority: P2)

**Goal**: Guests and free registered users see non-interruptive display ads; failures never break playback

**Independent Test**: As guest and free user, dock + explore slots mount; ad script failure leaves listening intact

### Tests for User Story 4 (REQUIRED) ⚠️

- [x] T047 [P] [US4] Unit test `shouldShowAds` for guest/free/premium in `tests/unit/ads-gate.test.js`
- [x] T048 [US4] Playwright: free session shows ad slot containers; playback still works in `tests/e2e/ads-free.spec.js`

### Implementation for User Story 4

- [x] T049 [US4] Add dock + explore-inline ad slot markup in `index.html` and styles in `src/styles/main.css` (atlas-consistent, non-card-spam)
- [x] T050 [US4] Implement `src/ads/ads.js` (`shouldShowAds`, `mountAdSlots`, `teardownAdSlots`) with lazy script load after first paint
- [x] T051 [US4] Call ad mount/teardown from auth/profile state changes in `src/main.js` / `src/api/supabase.js` listeners
- [x] T052 [US4] Ensure ad network failures are swallowed gracefully in `src/ads/ads.js` (no stuck UI)
- [x] T053 [P] [US4] Add `public/ads.txt` placeholder and document AdSense (or backup) application steps in `specs/001-dome-radio-pwa/quickstart.md`
- [x] T054 [US4] Confirm `public/sw.js` does not precache ad origins

**Checkpoint**: US4 independently testable — free users see slots; play uninterrupted

---

## Phase 7: User Story 5 - Paid registered users skip ads (Priority: P2)

**Goal**: Stripe subscription sets premium entitlement; ads tear down while paid; return after entitlement ends

**Independent Test**: Checkout (test mode) → no ads; cancel/expire → ads return; upgrade copy promises ad-free only

### Tests for User Story 5 (REQUIRED) ⚠️

- [x] T055 [P] [US5] Unit test `isPremium(profile)` including `premium_until` grace in `tests/unit/is-premium.test.js`
- [x] T056 [P] [US5] Unit test Stripe webhook status mapping (active/canceled/past_due → profile fields) in `tests/unit/stripe-webhook.test.js`
- [x] T057 [US5] Playwright: mocked premium profile hides ad slots; free shows slots in `tests/e2e/ads-premium.spec.js`

### Implementation for User Story 5

- [x] T058 [US5] Implement `netlify/functions/create-checkout.js` (verify user JWT, create Stripe Checkout session, ensure `stripe_customer_id`)
- [x] T059 [P] [US5] Implement `netlify/functions/create-portal.js` for Customer Portal sessions
- [x] T060 [US5] Implement idempotent `netlify/functions/stripe-webhook.js` updating `profiles.subscription_status` / `premium_until` via service role
- [x] T061 [US5] Add client helpers in `src/api/billing.js` calling checkout/portal functions
- [x] T062 [US5] Add Profile “Go ad-free” / “Manage subscription” CTAs in `src/views/profile.js` with ad-free-only messaging (FR-009)
- [x] T063 [US5] On profile refresh / auth change, call `teardownAdSlots` when `isPremium` in `src/ads/ads.js`
- [x] T064 [US5] Configure Netlify env secrets (`STRIPE_*`, `SUPABASE_SERVICE_ROLE_KEY`) documented in `.env.example` (values not committed)
- [x] T065 [US5] Add Netlify redirects/routes for functions in `netlify.toml` if required

**Checkpoint**: US5 independently testable — premium removes ads; entitlement end restores ads

---

## Phase 8: User Story 6 - Cast audio to another device (Priority: P2)

**Goal**: Chromecast (CAF) + AirPlay where available; empty state when unavailable; local play recoverable

**Independent Test**: Cast to Chromecast and/or AirPlay → audio on target; station switch follows or messages; stop restores local; no targets → empty UI

### Tests for User Story 6 (REQUIRED) ⚠️

- [x] T066 [P] [US6] Unit test cast session state machine (`idle`/`connecting`/`connected`/`error`) in `tests/unit/cast-session.test.js`
- [x] T067 [P] [US6] Unit test unavailable-targets empty state helper in `tests/unit/cast-availability.test.js`
- [x] T068 [US6] Playwright: cast control empty/unavailable does not break local play in `tests/e2e/cast-ui.spec.js` (mock CastContext)
- [x] T069 [US6] Manual QA checklist for physical Chromecast + AirPlay in `specs/001-dome-radio-pwa/quickstart.md` (V5) — execute before done

### Implementation for User Story 6

- [x] T070 [US6] Implement `src/cast/cast-controller.js` per `contracts/interfaces.md` (`watchAvailability`, `start`, `loadStation`, `stop`, `getState`)
- [x] T071 [P] [US6] Implement Google Cast Web Sender lazy-load + Default Media Receiver load in `src/cast/google-cast.js`
- [x] T072 [P] [US6] Implement AirPlay / remote-playback helpers for Safari/iOS media element in `src/cast/airplay.js`
- [x] T073 [US6] Add cast control + status UI in player dock (`index.html`, `src/styles/main.css`, `src/player/` integration)
- [x] T074 [US6] On cast start pause/duck local audio; on stop/disconnect restore local state (FR-012) in `src/cast/cast-controller.js` + `src/player/play.js`
- [x] T075 [US6] On station switch while casting, `loadStation` or show reconnect messaging in `src/cast/cast-controller.js`
- [x] T076 [US6] Ensure SW / Vite do not block Cast CDN; document optional `public/cast-receiver/` only if Default Media Receiver fails for streams
- [x] T077 [US6] Keep MediaSession for local remotes only; do not treat it as Story 6 completion in `src/player/media-session.js`

**Checkpoint**: US6 independently testable — Cast/AirPlay paths + empty state verified

---

## Phase 9: User Story 7 - Appearance preference / dark mode (Priority: P3)

**Goal**: Dark appearance preserved across primary screens without interrupting playback; preference persists on device

**Independent Test**: Toggle dark mode during playback → UI updates, audio continues; preference restored on return

### Tests for User Story 7 (REQUIRED) ⚠️

- [x] T078 [P] [US7] Unit test theme persistence read/write via `src/store.js` in `tests/unit/theme.test.js`
- [x] T079 [US7] Playwright: toggle appearance without stopping playback in `tests/e2e/theme.spec.js`

### Implementation for User Story 7

- [x] T080 [US7] Extract theme toggle / system preference logic into `src/views/theme.js` (or `src/theme.js`) using `dome:theme` in `src/store.js`
- [x] T081 [US7] Ensure dark tokens in `src/styles/main.css` cover primary views + player dock + ad slots + cast status
- [x] T082 [US7] Confirm theme change does not remount/destroy audio element mid-play in `src/main.js` / `src/player/play.js`

**Checkpoint**: US7 independently testable — dark mode non-regressive

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Quality gates across stories (constitution I–IV)

- [x] T083 [P] Run ESLint/Prettier on `src/` and `netlify/functions/` and fix violations
- [x] T084 Verify UX consistency: loading/empty/error/playing/offline/cast-status patterns across `src/views/` and player (III)
- [x] T085 Measure station-select → audible start (≤3s) and document result in `specs/001-dome-radio-pwa/quickstart.md` (IV)
- [x] T086 [P] Fill remaining unit coverage gaps for sync merge, webhook idempotency, ads gate in `tests/unit/`
- [x] T087 Confirm client bundle has no `service_role` / Stripe secret leakage (`npm run build` + grep `dist/`)
- [x] T088 Document Supabase Free inactivity-pause risk and optional keep-alive in `specs/001-dome-radio-pwa/quickstart.md`
- [x] T089 Run full `specs/001-dome-radio-pwa/quickstart.md` validation scenarios V1–V6
- [x] T090 [P] Update README (if present) or add minimal root `README.md` with setup, env, and link to `specs/001-dome-radio-pwa/plan.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS** all user stories
- **US1 (Phase 3)**: After Foundational — MVP
- **US2 (Phase 4)**: After Foundational; ideally after US1 shell is stable (shares SW/`main.js`)
- **US3 (Phase 5)**: After Foundational; needs working player from US1 for favorite-from-station flows
- **US4 (Phase 6)**: After Foundational; better after US3 profile/auth exists for free-registered ad parity
- **US5 (Phase 7)**: Depends on US3 (auth/profile) + US4 (ads gate to tear down)
- **US6 (Phase 8)**: After Foundational + US1 player; independent of ads/billing
- **US7 (Phase 9)**: After Foundational; can run parallel to US3–US6 once CSS extracted
- **Polish (Phase 10)**: After desired stories complete

### User Story Dependencies

- **US1 (P1)**: After Phase 2 only — MVP
- **US2 (P1)**: After Phase 2; integrates SW with US1 shell
- **US3 (P2)**: After Phase 2; uses US1 playback surfaces
- **US4 (P2)**: After Phase 2; uses guest + free registered (US3) for full acceptance
- **US5 (P2)**: Requires US3 + US4
- **US6 (P2)**: After Phase 2 + US1 player; parallelizable with US3/US4 if staffed
- **US7 (P3)**: After Phase 2; parallelizable early

### Within Each User Story

- Tests MUST be written and FAIL before implementation where practicable
- Contracts/helpers before UI wiring
- Story complete before claiming checkpoint

### Parallel Opportunities

- Phase 1: T002–T004, T006 in parallel
- Phase 2: T011–T012 in parallel; T018–T019 in parallel after structure exists
- After Phase 2: US6 and US7 can proceed in parallel with US3
- US4 tests T047 parallel; US5 tests T055–T056 parallel
- US6 implementation T071–T072 parallel after T070 interface sketched

---

## Parallel Example: User Story 1

```bash
# Tests in parallel:
Task: "Unit test Radio Browser mirror failover in tests/unit/radio-browser.test.js"
Task: "Unit test playback state machine in tests/unit/player-state.test.js"

# Then implementation sequentially on shared player:
Task: "Wire explore/discover/search to src/player/play.js"
Task: "Handle unreachable streams in src/player/play.js"
```

## Parallel Example: User Story 6

```bash
# After cast-controller interface:
Task: "Implement Google Cast in src/cast/google-cast.js"
Task: "Implement AirPlay helpers in src/cast/airplay.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Guest browse → play
5. Deploy Netlify preview if ready

### Incremental Delivery

1. Setup + Foundational → modular PWA shell
2. US1 → MVP listening
3. US2 → install/offline shell
4. US3 → auth + favorites
5. US4 → ads for free
6. US5 → Stripe premium
7. US6 → Chromecast + AirPlay
8. US7 → dark mode non-regression
9. Polish → constitution quality gates

### Parallel Team Strategy

1. Team completes Setup + Foundational together
2. Then:
   - Dev A: US1 → US2
   - Dev B: US3 → US4 → US5
   - Dev C: US6 (+ US7)
3. Integrate at checkpoints; run quickstart V1–V6 before release

---

## Notes

- [P] tasks = different files, no dependencies on incomplete work
- [Story] label maps task to US1–US7 for traceability
- Creator/Studio remains hidden — no story tasks implement live broadcast
- Near-zero cost: no paid SaaS beyond free tiers; Stripe only charges on success
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: React rewrite, audio pre-roll ads, Radio Browser proxy (unless forced later)
