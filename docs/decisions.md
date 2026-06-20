# Decisions

## Product Decisions

- Pluribus is not positioned as an AI image generator.
- Pluribus is the operating system for commercial identity rights.
- The long-term destination is B2B infrastructure — a consent + licensing API embedded in other creative tools, agency platforms, and brand portals.
- The near-term wedge is the end-to-end production workflow: identity capture → AI generation → consent → approval → licensed export.
- The first vertical is talent-driven industries: athletes, actors, influencers. Common thread: a human with commercial likeness value who must consent before AI-generated representations go public.
- Workflow, identity, approval, consent, and rights records are more important than raw generation quality.
- Revenue model: Platform Fee + Talent Tiers (decided 2026-06-20). API licensing is a Phase 3+ revenue line, not yet scoped.
- The B2B API / infrastructure play (embedding consent + licensing in other tools) is a Phase 3 move — do not build speculatively. The trigger is a customer asking to embed Pluribus rather than use it directly.

---

## Generation Decisions

### Nano Banana exclusively (Sprint 14)
All image generation uses `fal-ai/nano-banana` (IP-Adapter model). The two-stage pipeline (NB → FLUX dev img2img) and the LoRA path have been removed. Reasons:
- NB is an IP-Adapter model — identity comes from reference images, not text; adding a FLUX editorial pass added cost and latency without meaningful identity gain
- Simplifying to a single model removes fragility from the critical generation path
- The production bottleneck is identity consistency (solved by refs) and creative direction (solved by recipe), not image rendering quality

### NB prompt structure (Sprint 14)
NB prompts are 7 structured scene fields joined into a comma-separated string, ≤60 words: `shot`, `action`, `environment`, `lighting`, `mood`, `style`, `colorStyle`. Subject text descriptors, identity constraints, and house-style blocks are NOT injected — NB reads these as wasted tokens and the identity is already locked by reference images. The legacy `recipe.prompt` field is kept optional for backward compat with user-created recipes.

### Reference image passing (Sprint 14)
All available captures (up to 9) are passed to NB as `reference_image_urls`. Face-close has the highest priority. Priority order: `face-close`, `front-passport`, `left-passport`, `right-passport`, `back-passport`, `front-body`, `left-body`, `right-body`, `back-body`, then legacy keys.

### doNotChange constraints removed from prompts (Sprint 14)
Subject-level `doNotChange` constraints (e.g., "prosthetic left arm", "signature neck tattoo") are no longer injected into generation prompts. Identity comes from reference images in the NB model. This is a known capability regression — plan to reinstate as brief appended scene notes in Sprint 15.

### House style conditioning placeholder (Sprint 14)
`ACTIVE_HOUSE_STYLE.styleReferenceUrls` is `[]` until editorial style reference images are sourced and uploaded to fal CDN. The style conditioning path in `generateImage` is wired and ready.

---

## Architecture Decisions

- Existing architecture must be audited before major changes.
- New features should extend the current architecture where possible.
- Destructive migrations should be avoided unless explicitly approved.
- `data/workflows.ts` was a legacy file superseded by the recipe system — deleted in Sprint 6.
- `Athlete.sport` is a free-form `string` — the original enum was too restrictive.
- `app/lib/utils.ts` is the shared home for non-component utility functions.
- All new fields added to `CampaignOutput` are optional — no data migration ever required.
- `LibraryPage` reads from localStorage on mount and does not subscribe to store changes. Navigating away and back refreshes the list. This is acceptable given the single-user model.
- Tag strings are stored lowercase and trimmed. `addOutputTag` is idempotent.
- `brief` state in `CampaignWorkspace` is initialized directly from `getProjects()` to avoid stale prop.
- Quality checklist checked state is session-local. It resets on navigation intentionally — checklist is a review aid, not a persistent approval record.
- `briefSavedTimerRef` pattern (useRef + clearTimeout before each new setTimeout) is the project standard for transient UI feedback timers.

### Recipe schema evolution (Sprint 14)
The `Recipe` interface has been migrated from a text-prompt model to a structured NB scene model. Old fields (`styleRules`, `lightingRules`, `compositionRules`, `cameraStyle`, `toneStyle`) are now absent from seed recipes and from the recipe creation form. They are kept as optional TypeScript fields for backward compat only — user-created recipes using them will still render in the sidebar but the rules arrays will show as empty sections.

### v3 capture protocol (Sprint 14)
9 frames: 5 angles × passport + body formats, plus a face close-up. Semantic key names (`front-passport`, `left-body`, etc.) replace the opaque `frame-1` through `frame-9` numbering. Legacy keys retained for stored profile backward compat. The face close-up (`face-close`) is always the primary NB identity anchor.

---

## Security Decisions (Sprint 13)

### Auth bypass gating
`BYPASS_AUTH` changed from a hardcoded constant to `import.meta.env.VITE_BYPASS_AUTH === "true"`. The env var is only set in `.env.local` (gitignored); production builds never bypass auth.

### Consent scope validation
Usage scopes submitted via the talent portal are validated server-side against `VALID_CONSENT_SCOPES = {"social_media","paid_advertising","out_of_home","press_editorial","internal_only","unlimited"}`. Unknown strings are rejected at the proxy with 400 before touching the DB or email template.

### Email HTML escaping
All user-sourced strings (`subjectName`, `note`, scope values) are run through `htmlEscape()` before interpolation into Resend email HTML. This prevents stored XSS via the consent receipt email. The helper is defined at the proxy level, not imported from a library, to avoid adding a dependency for a 5-line function.

### athlete_id anchor on subject approve/reject
Approve and reject proxy routes constrain Supabase UPDATE on both `user_id` AND `athlete_id`. Without the athlete_id constraint, a valid portal token holder could approve/reject outputs belonging to a different subject on the same operator account. This is the most critical security decision in Sprint 13.

### Portal token revocation: optimistic UI + retry
`revokePortalToken` clears the token in memory immediately (optimistic UI), then retries the Supabase UPDATE up to 3 times (0/2/4s backoff). On total failure, in-memory state is restored and `_onWriteError` fires (triggering "Saved locally" toast). This prevents the UI showing "revoked" while the token remains valid in the DB.

### Realtime subscription placement
Supabase Realtime channel for `campaign_outputs` approval events is created in `initStore`, not `hydrateStore`. This ensures: (1) exactly one channel per session, (2) the channel is cleaned up on `clearStore` (logout), (3) `TOKEN_REFRESHED` events in `onAuthStateChange` skip `initStore` entirely — no unnecessary teardown/recreate on token refresh.

### "Share approved" button
The SubjectPortal "Share approved" button previously copied the writable portal URL to clipboard — sharing it would grant a third party full portal write access (re-submit consent, re-upload, flip approval states). Changed to copy a plain-text approval receipt instead. The portal URL is never exposed via the share flow.

### Revenue model
Platform Fee + Talent Tiers. Decided during CEO review office hours session 2026-06-20.

## UX Decisions

- The interface should feel production-grade.
- Avoid generic SaaS dashboard sprawl.
- Avoid toy-like AI interface patterns.
- Prioritize large asset previews, clear states, and fast review.
- Campaign creation is a multi-step wizard (Details → Subjects → Recipe → Moodboard) — not a single-form modal. Each step has a clear purpose and reduces cognitive load.
- Dashboard does not show a greeting or stats header — the product should feel like a production tool, not a consumer app. The default view is the campaigns list.
