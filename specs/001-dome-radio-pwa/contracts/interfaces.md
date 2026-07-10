# Contracts: Client ↔ Backend

**Feature**: The Dome Radio PWA  
**Date**: 2026-07-09

These contracts describe interfaces the PWA and Netlify Functions expose. Station catalog remains the external Radio Browser HTTP API (unchanged client failover).

---

## 1. Supabase Auth (client)

Library: `@supabase/supabase-js` with `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.

| Operation | Behavior | Errors |
|-----------|----------|--------|
| `signUp({ email, password })` | Creates user; profile row via trigger | Duplicate email, weak password |
| `signInWithPassword({ email, password })` | Session JWT in client storage | Invalid credentials |
| `signOut()` | Clears session; UI returns to guest | — |
| `onAuthStateChange` | Drives sync pull and ad gate refresh | — |

**Guest**: No session. Favoriting triggers auth UI (FR-006).

---

## 2. Profiles

### Read own profile

```http
GET /rest/v1/profiles?select=*&id=eq.{uid}
Authorization: Bearer {user_jwt}
```

Response (200): single row including `subscription_status`, `premium_until` (readable).

### Update display fields only

```http
PATCH /rest/v1/profiles?id=eq.{uid}
Authorization: Bearer {user_jwt}
Content-Type: application/json

{ "display_name": "Ada", "avatar_url": null }
```

**Forbidden for user JWT**: `stripe_customer_id`, `subscription_status`, `premium_until`.

### Client helper

```ts
function isPremium(profile: Profile | null): boolean
```

---

## 3. Favorites

| Op | Contract |
|----|----------|
| List | `GET /rest/v1/favorites?select=*&order=created_at.desc` |
| Add | `POST /rest/v1/favorites` body `{ station_uuid, station_snapshot }` |
| Remove | `DELETE /rest/v1/favorites?station_uuid=eq.{uuid}` |

Unique violation on duplicate → treat as success (idempotent favorite).

---

## 4. Recents

| Op | Contract |
|----|----------|
| List | `GET /rest/v1/recents?select=*&order=played_at.desc&limit=12` |
| Upsert | `POST` with `on_conflict=user_id,station_uuid` updating `played_at` + snapshot |

After upsert, client or DB trigger enforces max 12 rows per user.

---

## 5. Netlify Functions — Billing

Base path: `/.netlify/functions/` (or redirects in `netlify.toml`).

### `POST create-checkout`

**Auth**: User JWT (verify with Supabase) or session cookie pattern agreed in implementation.

**Body**:

```json
{ "priceId": "price_xxx" }
```

**Response 200**:

```json
{ "url": "https://checkout.stripe.com/..." }
```

**Side effects**: Ensures Stripe Customer exists; stores `stripe_customer_id` via service role if missing.

**Errors**: 401 unauthenticated; 400 missing price; 502 Stripe failure.

### `POST create-portal`

**Auth**: Same as checkout.

**Response 200**:

```json
{ "url": "https://billing.stripe.com/..." }
```

**Errors**: 401; 404 if no `stripe_customer_id`.

### `POST stripe-webhook`

**Auth**: Stripe signature header `Stripe-Signature` + `STRIPE_WEBHOOK_SECRET`.

**Handled events** (minimum):

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed` (optional → `past_due`)

**Side effects**: Upsert `profiles.subscription_status` and `premium_until` using **service role**.

**Response**: `200` on success; `400` on bad signature. Idempotent on replay.

---

## 6. Ads gate (client contract)

```ts
type AdSlotId = 'dock' | 'explore-inline';

function shouldShowAds(profile: Profile | null): boolean;
// true for guest and free registered; false when isPremium(profile)

function mountAdSlots(slots: AdSlotId[]): void;  // no-op if !shouldShowAds
function teardownAdSlots(): void;                // on premium or sign-out→re-eval
```

Slots are empty DOM containers; ad network script loads only when `shouldShowAds` is true. Service worker must not precache ad origins.

---

## 7. Radio Browser (external, unchanged)

Client `api(path)` with mirror failover. No Dome-owned contract beyond “reachable station list + stream URL for playback.”

---

## 8. Cast / AirPlay (client)

### Google Cast Web Sender

- Lazy-load `cast_sender.js?loadCastFramework=1` on first cast intent.
- Use `cast.framework.CastContext` for availability, session start/end, and `loadMedia` with the station stream URL + metadata (name, favicon).
- v1 receiver: Default Media Receiver unless stream quirks require `public/cast-receiver/` Custom Web Receiver (static on Netlify, $0).

### AirPlay / remote playback

- On Safari / iOS / iPadOS: enable external playback on the media element and expose a route/cast control in the player dock.
- When the platform cannot offer AirPlay (e.g. Chrome on Windows), cast UI shows empty/unavailable for that path without breaking local play (FR-012).

### Client contract

```ts
type CastProvider = 'cast' | 'airplay';
type CastState = 'idle' | 'connecting' | 'connected' | 'error';

interface CastController {
  watchAvailability(cb: (available: boolean) => void): void;
  start(station: StationSnapshot, provider?: CastProvider): Promise<void>;
  loadStation(station: StationSnapshot): Promise<void>; // while connected
  stop(): Promise<void>;
  getState(): { provider: CastProvider | 'none'; state: CastState; deviceName?: string };
}
```

Local `<audio>` pauses or stops while casting; on `stop`/disconnect, restore a sensible local state (FR-012). Service worker must not precache Cast CDN origins.

---

## 9. PWA shell

| Asset | Contract |
|-------|----------|
| `manifest.json` | `name`, icons, `display`, `start_url`, theme colors |
| `sw.js` | Network-first navigate; cache-first same-origin static; pass-through cross-origin |

Installability per Spec Story 2.
