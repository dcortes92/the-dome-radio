# Feature Specification: The Dome Radio PWA

**Feature Branch**: `001-dome-radio-pwa`

**Created**: 2026-07-09

**Status**: Draft

**Input**: User description: "We want to build the dome radio, a PWA that streams radio stations. We already have a working prototype but we want to take a step back and specify it better. It should support users but you don't need an account to stream the radios. Registered users can have favorite stations. Both registered and guests will see ads. Paid registered users will skip ads and we're still defining the other perks for paid users. The current prototype already works and some features like dark mode work too. Both guests and registered users can stream this to devices (cast)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Stream a station as a guest (Priority: P1)

A visitor opens The Dome Radio without signing in, browses available stations, picks one, and hears live audio. Playback controls (play, pause, stop, change station) work without an account.

**Why this priority**: Listening without friction is the core product value; everything else builds on a working stream.

**Independent Test**: Open the app as a signed-out visitor, select a station, confirm audible playback and basic controls without creating an account.

**Acceptance Scenarios**:

1. **Given** a visitor is not signed in, **When** they open The Dome Radio, **Then** they can browse stations and start streaming without being prompted to register.
2. **Given** a guest is listening to a station, **When** they pause or switch stations, **Then** playback responds within the expected control feedback and the new station (if selected) begins streaming.
3. **Given** a guest's network drops briefly during playback, **When** connectivity returns, **Then** the app recovers playback or shows a clear recoverable error without requiring sign-in.

---

### User Story 2 - Install and use as a PWA (Priority: P1)

A listener installs The Dome Radio on a supported device and can launch it like an app, with offline-aware shell behavior for the UI where the prototype already supports it, while live audio still requires connectivity.

**Why this priority**: PWA installability is a defining product surface for The Dome and protects return visits.

**Independent Test**: Install the app from a supported browser, relaunch from the home screen/app launcher, and confirm station browsing UI loads and streaming still works when online.

**Acceptance Scenarios**:

1. **Given** a supported browser and device, **When** the listener chooses to install The Dome Radio, **Then** the app is available as an installed experience.
2. **Given** the installed app is launched while online, **When** the listener selects a station, **Then** streaming works the same as in the browser session.
3. **Given** the listener is offline, **When** they open the installed app, **Then** they see a clear offline state for streaming (not a blank or broken shell) and can retry when back online.

---

### User Story 3 - Register, sign in, and manage favorites (Priority: P2)

A listener creates an account (or signs in), marks stations as favorites, and later returns to find those favorites preserved across sessions and devices where they are signed in.

**Why this priority**: Favorites are the primary registered-user benefit called out for v1 beyond anonymous listening.

**Independent Test**: Register (or sign in), favorite several stations, sign out and back in (or use another session), and confirm favorites persist; confirm guests cannot persist favorites to an account.

**Acceptance Scenarios**:

1. **Given** a guest wants an account, **When** they complete registration and sign in, **Then** they become a registered user and can access account-backed features.
2. **Given** a signed-in registered user is viewing a station, **When** they favorite it, **Then** the station appears in their favorites list.
3. **Given** a signed-in registered user has favorites, **When** they unfavorite a station, **Then** it is removed from their favorites and stays removed after refresh.
4. **Given** a guest (not signed in), **When** they attempt to favorite a station, **Then** they are guided to sign in or register before the favorite is saved to an account.
5. **Given** a registered user signs in on another session, **When** they open favorites, **Then** they see the same saved stations.

---

### User Story 4 - Ads for free listeners (Priority: P2)

Guests and free registered users see ads while using the product. Ads must not block the ability to discover that streaming works, but free listening includes ad exposure.

**Why this priority**: Ads fund free listening for both guests and registered users; behavior must be explicit and consistent.

**Independent Test**: As a guest and as a free registered user, start playback and confirm ads are presented according to the free-tier rules; confirm a paid user does not see them (covered in Story 5).

**Acceptance Scenarios**:

1. **Given** a guest starts or continues listening, **When** an ad is due per free-tier rules, **Then** an ad is shown or played and listening continues afterward according to those rules.
2. **Given** a free registered user is listening, **When** an ad is due, **Then** they receive the same free-tier ad experience as guests.
3. **Given** an ad fails to load, **When** the free listener is in a playback session, **Then** the app fails gracefully (no permanent stuck state) and listening can continue or retry without crashing the session.

---

### User Story 5 - Paid registered users skip ads (Priority: P2)

A registered user with an active paid entitlement listens without ads. Other paid perks are intentionally out of scope until defined.

**Why this priority**: Ad-free listening is the only paid benefit specified for this release; it must be reliable and clearly tied to paid status.

**Independent Test**: With a paid registered test account, stream multiple stations and confirm no ads; revoke or expire paid status and confirm ads return.

**Acceptance Scenarios**:

1. **Given** a registered user has active paid status, **When** they stream any station, **Then** they do not see or hear ads.
2. **Given** a paid user's entitlement ends, **When** they continue listening, **Then** they receive the free-tier ad experience.
3. **Given** a guest or free registered user, **When** they view upgrade messaging (if shown), **Then** the only promised paid benefit in this release is ad-free listening.

---

### User Story 6 - Cast audio to another device (Priority: P2)

Guests and registered users can send the current station's audio to a compatible cast/target device in the environment.

**Why this priority**: Casting to speakers/TVs is an expected listener capability for both guests and registered users (Chromecast + AirPlay in v1).

**Independent Test**: From a guest session and a registered session, start a station, cast to a Chromecast or AirPlay target, confirm audio plays on the target, switch station if supported, and stop/disconnect cleanly.

**Acceptance Scenarios**:

1. **Given** a guest is playing a station and a compatible cast target is available, **When** they start casting, **Then** audio plays on the target device.
2. **Given** a registered user is casting, **When** they switch stations, **Then** the cast session follows the new station or clearly indicates if a reconnect is required.
3. **Given** an active cast session, **When** the listener stops casting or the target disconnects, **Then** playback returns to a sensible local state (local resume or stopped) with clear status.
4. **Given** no compatible cast targets are available, **When** the listener opens cast controls, **Then** they see an empty/unavailable state rather than a failure that breaks local playback.

---

### User Story 7 - Appearance preference (dark mode) (Priority: P3)

Listeners can use dark mode (already present in the prototype) so the atlas UI remains comfortable in low light and consistent with the established visual language.

**Why this priority**: Already working in the prototype; must remain specified so it is not regressed while other features evolve.

**Independent Test**: Toggle appearance (or follow system preference if that is the prototype behavior), confirm UI updates across primary screens, and confirm preference persists for the session/device as designed.

**Acceptance Scenarios**:

1. **Given** a listener is on a primary screen, **When** they enable dark mode (or system dark preference applies), **Then** the UI switches to the dark appearance without breaking layout or playback.
2. **Given** a listener has chosen an appearance, **When** they leave and return later on the same device, **Then** the appearance preference is restored as designed.

---

### Edge Cases

- What happens when a station stream URL is unreachable or returns an error? Show a clear error and allow selecting another station; do not leave controls in a permanent "playing" state.
- What happens when the listener favorites a station that is later removed from the catalog? Favorites list shows the station as unavailable or removes it with a clear explanation; does not crash.
- What happens when cast is started but the target rejects the session? Local playback remains usable; error is understandable.
- What happens when a free user backgrounds the app during an ad? Ad/session rules resume safely without locking the UI on return.
- What happens when a paid entitlement cannot be verified (network/account error)? Prefer last-known entitlement for a short grace window if already established in-session; otherwise treat as free tier and show a recoverable status—never silently grant paid forever without verification policy defined in planning.
- What happens when two sessions for the same account update favorites concurrently? Last successful save wins; next refresh shows server truth.
- What happens when the listener is on a metered or very slow network? App remains usable for browsing; streaming may buffer with visible status rather than hanging indefinitely.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow guests to browse stations and start/stop/switch live streams without creating an account.
- **FR-002**: System MUST present clear playback states: loading, playing, paused/stopped, buffering, and error.
- **FR-003**: System MUST be installable and usable as a Progressive Web App on supported platforms.
- **FR-004**: System MUST allow listeners to register and sign in to a personal account.
- **FR-005**: System MUST allow signed-in registered users to add, view, and remove favorite stations that persist across sessions.
- **FR-006**: System MUST NOT persist account-backed favorites for guests; guests who try to favorite MUST be prompted to sign in or register.
- **FR-007**: System MUST show ads to guests and to registered users who are not on an active paid plan.
- **FR-008**: System MUST skip ads for registered users with an active paid entitlement.
- **FR-009**: System MUST limit paid benefits in this specification to ad-free listening; additional paid perks are out of scope until separately specified.
- **FR-010**: System MUST allow both guests and registered users to cast the current station audio to a compatible external device when available.
- **FR-011**: System MUST support a dark appearance mode consistent with the existing prototype behavior and visual language.
- **FR-012**: System MUST keep local playback usable when casting is unavailable, fails, or ends.
- **FR-013**: System MUST provide a clear offline or connectivity-error experience when live streaming cannot proceed.
- **FR-014**: System MUST distinguish guest, free registered, and paid registered experiences in behavior (favorites, ads) without requiring paid status to listen.
- **FR-015**: System MUST allow signed-in users to sign out and return to guest listening capabilities.

### Key Entities

- **Listener (Guest)**: Unauthenticated person who can browse, stream, see ads, and cast; cannot save account-backed favorites.
- **Registered User**: Authenticated listener with a durable identity; can manage favorites; sees ads unless paid.
- **Paid Entitlement**: Active paid status on a registered user that disables ads; no other perks defined in this spec.
- **Station**: A radio stream available in the catalog (identity, display name, and stream availability).
- **Favorite**: A registered user's saved relationship to a station.
- **Ad Impression / Ad Break**: A free-tier advertising experience shown or played according to free-tier rules.
- **Cast Session**: A connection that sends station audio to a compatible external device.
- **Appearance Preference**: Listener setting (or system-linked preference) for light/dark UI.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 95% of guest attempts to start a reachable station result in audible playback without being forced to register.
- **SC-002**: A new listener can discover a station and start listening within 60 seconds on a typical mobile network.
- **SC-003**: Registered users can favorite or unfavorite a station in under 5 seconds, and the change remains visible after reload in at least 99% of successful save attempts.
- **SC-004**: 100% of sessions with verified active paid entitlement play without ads during the paid period under test.
- **SC-005**: Guests and free registered users encounter the free-tier ad experience in 100% of test sessions that meet ad-eligibility rules.
- **SC-006**: On a device with a compatible cast target available, cast can be started from a playing station in under 30 seconds in successful test runs.
- **SC-007**: PWA install succeeds on the project's supported browser/device matrix, and relaunch from the installed icon reaches a usable UI in under 3 seconds on a warm device.
- **SC-008**: Dark appearance can be applied from any primary screen without interrupting an active stream.
- **SC-009**: Critical listener paths (browse → play, favorite while signed in, cast start/stop, ad-free paid playback) achieve at least 90% task success in moderated usability checks or equivalent acceptance runs.

### Non-Functional Requirements *(align with The Dome Constitution)*

- **NFR-UX-001**: Loading, empty, error, playing, buffering, offline, and cast-status feedback MUST feel like one coherent atlas (shared patterns, copy tone, and visual language—including dark mode).
- **NFR-UX-002**: Touch targets, keyboard access, and screen-reader labels for primary playback and account actions MUST meet the same accessibility bar as visual polish.
- **NFR-PERF-001**: From station selection to audible start MUST complete within 3 seconds on a median mobile network for a reachable stream (excluding intentional ad breaks).
- **NFR-PERF-002**: Primary UI MUST remain responsive during playback, buffering, and cast connect; interactions MUST NOT freeze for more than 1 second under normal conditions.
- **NFR-PERF-003**: Features MUST NOT regress Core Web Vitals relative to the current prototype baseline without an explicit, reviewed trade-off.
- **NFR-TEST-001**: Acceptance scenarios for P1 and P2 stories MUST have automated coverage (unit, integration, or end-to-end as appropriate) before the feature is considered done.
- **NFR-TEST-002**: Regression coverage MUST include station playback start/stop, favorites for registered users, ad vs ad-free behavior by entitlement, cast connect/disconnect happy path, PWA install/launch smoke, and dark mode toggle.
- **NFR-SEC-001**: On HTTPS origins, station artwork and other remote images rendered by the app MUST NOT be requested over plain `http://` (upgrade to `https://` or omit / fall back) so the page does not trigger mixed-content warnings. Stream URLs MAY remain `http://` when that is all a station provides.

## Assumptions

- A working prototype already delivers core streaming, PWA basics, dark mode, and MediaSession remotes; this specification re-baselines product behavior. **Chromecast and AirPlay casting are in scope for v1** even though they are not implemented in the prototype yet (stakeholder decision 2026-07-09).
- Station catalog content exists (or will continue to be supplied) so listeners have stations to browse; catalog curation tooling is out of scope unless required to meet listening scenarios.
- "Paid registered user" means a registered account with an active paid entitlement; payment provider UX and plan catalog beyond "paid = ad-free" are deferred to a later specification.
- Additional paid perks beyond skipping ads are explicitly out of scope for this feature until separately defined.
- Free-tier ads apply equally to guests and free registered users; exact creative partner and fill strategy may be chosen in planning as long as FR-007/FR-008 and related success criteria hold.
- Ad timing defaults to: free listeners may see ads at session/playback boundaries and at reasonable intervals during continuous listening, without making registration mandatory to hear audio.
- Casting targets for v1 are **Google Cast (Chromecast / Cast-enabled TVs)** and **AirPlay** where the browser/OS exposes them. AirPlay is not required from non-Apple browsers. Expanding to every smart-TV SDK is not required. MediaSession remains for local device remotes and does not by itself satisfy cast scenarios.
- Appearance preference defaults to preserving current prototype behavior (explicit toggle and/or system preference).
- Account recovery, social login providers, and parental controls follow common consumer-app defaults and can be detailed in planning without blocking this spec.
- Live radio requires network connectivity; offline mode covers app shell and clear messaging, not offline playback of live stations.
