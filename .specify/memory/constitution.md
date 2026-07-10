<!--
Sync Impact Report
- Version change: (unversioned template) → 1.0.0
- Modified principles:
  - [PRINCIPLE_1_NAME] → I. Code Quality
  - [PRINCIPLE_2_NAME] → II. Testing Standards
  - [PRINCIPLE_3_NAME] → III. User Experience Consistency
  - [PRINCIPLE_4_NAME] → IV. Performance Requirements
  - [PRINCIPLE_5_NAME] → removed (four focus areas specified)
- Added sections:
  - Quality Gates
  - Development Workflow
  - Governance (concrete rules)
- Removed sections: none (template placeholders replaced)
- Templates requiring updates:
  - ✅ .specify/templates/plan-template.md (Constitution Check gates)
  - ✅ .specify/templates/spec-template.md (NFR / UX / performance criteria)
  - ✅ .specify/templates/tasks-template.md (mandatory testing discipline)
  - ✅ .specify/templates/checklist-template.md (quality categories note)
  - ⚠ .specify/templates/commands/*.md (directory not present; N/A)
  - ⚠ README.md / docs/quickstart.md (not present; deferred)
- Follow-up TODOs:
  - Add a project README that links to this constitution when docs are introduced
-->

# The Dome Constitution

## Core Principles

### I. Code Quality

All code MUST be readable, maintainable, and consistent with existing
patterns in the repository. Changes MUST prefer clarity over cleverness:
small, focused modules; descriptive names; and minimal unnecessary
abstraction. Every change MUST leave the codebase at least as easy to
navigate as before. Dead code, unused assets, and speculative
generalizations MUST NOT ship. Linting and formatting rules, once
adopted for a stack, MUST pass before merge. Rationale: The Dome is a
long-lived listener-facing product; messy code slows every future
feature and increases regression risk in audio and map flows.

### II. Testing Standards

Behavior that users can observe MUST be covered by automated tests
before a feature is considered done. Acceptance scenarios from the
feature spec MUST map to executable tests (unit, integration, or
end-to-end as appropriate). Tests MUST be written to fail first when
practicable, then pass against the implementation. Critical paths —
station discovery, playback start/stop, map interaction, and offline /
PWA install behavior when in scope — MUST have regression coverage.
Flaky tests MUST be fixed or quarantined with an owner; they MUST NOT
block silently. Rationale: Radio and map UX failures are hard to spot
in review alone; tests protect listener trust.

### III. User Experience Consistency

The product MUST feel like one coherent atlas: shared visual language,
interaction patterns, and feedback for loading, empty, error, and
playing states. New UI MUST reuse established components, spacing,
typography, and motion conventions unless a documented design change
updates the system. Touch targets, keyboard access, and screen-reader
labels MUST meet the same bar as visual polish. Copy and status
messaging MUST be clear and consistent across surfaces. Breaking the
established monochrome atlas aesthetic or inventing one-off patterns
without justification is a constitution violation. Rationale: Listeners
judge the product by how reliably and recognizably it behaves, not by
isolated screens.

### IV. Performance Requirements

User-facing interactions MUST stay responsive under normal network and
device conditions. Plans and specs MUST state measurable performance
targets for the feature (for example: time-to-interactive, map pan /
zoom smoothness, station tune latency, asset weight). Features MUST
NOT regress Core Web Vitals or introduce unbounded main-thread work
without an explicit, reviewed trade-off. Media and map assets MUST be
loaded with intentional caching and lazy strategies; large payloads
MUST NOT block first paint of primary UI. Performance claims in
success criteria MUST be verifiable (profile, lighthouse, or timed
manual check documented in the plan). Rationale: A radio atlas that
stutters or stalls loses the session before the signal matters.

## Quality Gates

A change is not ready to merge until all of the following hold:

- Constitution Check in the feature plan passes (or justified
  exceptions are recorded in Complexity Tracking).
- Automated tests for in-scope acceptance scenarios pass locally and
  in CI when CI exists.
- Lint/format checks pass for touched stacks.
- UX review confirms consistency with existing patterns (or an approved
  design delta is linked).
- Performance targets defined for the feature are measured and met, or
  an explicit waiver with owner and expiry is recorded.

## Development Workflow

1. Specify the feature (`spec.md`) with user scenarios, requirements,
   and measurable success criteria including UX and performance where
   relevant.
2. Plan (`plan.md`) with a Constitution Check against these principles
   before research and again after design.
3. Task (`tasks.md`) with test tasks paired to each user story; tests
   precede or accompany implementation, never as an afterthought.
4. Implement in story-sized increments; validate each story
   independently against its Independent Test and performance notes.
5. Review for principle compliance: quality, tests, UX consistency,
   and performance evidence in the PR description.

## Governance

This constitution supersedes informal practice when they conflict.
Amendments MUST be documented in `.specify/memory/constitution.md`
with an updated Sync Impact Report, semantic version bump, and
`Last Amended` date. Versioning policy: MAJOR for removed or
incompatible principle changes; MINOR for new principles or materially
expanded rules; PATCH for clarifications and non-semantic edits.
Pull requests and implementation reviews MUST verify compliance with
the Core Principles and Quality Gates. Complexity or principle
exceptions MUST be justified in the plan's Complexity Tracking table.
Dependent templates under `.specify/templates/` MUST stay aligned when
principles change.

**Version**: 1.0.0 | **Ratified**: 2026-07-09 | **Last Amended**: 2026-07-09
