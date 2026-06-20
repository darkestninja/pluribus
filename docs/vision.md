# Pluribus Vision

## 1. Overview

Pluribus is the operating system for commercial identity rights.

We manage consent, approvals, licensing, AI usage permissions, asset generation, and monetization across millions of athlete and creator identities.

**Talent scope:** athletes, actors, influencers, musicians, and any human subject whose likeness has commercial value and requires controlled representation, legal consent, and creative approval before public use.

**The long arc:** Today Pluribus is a production platform used by creative teams and brands. The destination is infrastructure — a consent and rights layer that other production tools (creative platforms, agency systems, Figma plugins, brand portals) embed rather than rebuild. Pluribus becomes the Stripe of identity consent: invisible, essential, compounding.

**The near term:** The first wedge is the end-to-end production workflow — identity capture → AI generation → consent → approval → licensed export. Every brand or agency that processes a talent likeness commercially needs what Pluribus does. The consent flow is the legal exposure that makes Pluribus unavoidable, not just convenient.

**Build status (as of 2026-06-20):** Production-hardened. Sprints 1–20 + Sprint 13 complete. Deployed at https://pluribus.danielasiegbunam.com. Validated with one paying customer (Enhanced.com). Ready for second customer onboarding.

---

## 2. Strategic Positioning

Pluribus should be positioned as:

**"The operating system for commercial identity rights."**

One sentence for a customer: "We handle consent, approvals, and AI generation so brands can use talent likenesses commercially — legally and at scale."

One sentence for an investor: "We're building the infrastructure layer for commercial identity rights — the consent and licensing OS that sits underneath every AI-generated use of a human likeness."

Pluribus should not be positioned as:

- AI image generator
- Prompt tool
- Canva with AI
- Midjourney for athletes
- Consumer AI image app
- AI art toy

The product should feel like serious infrastructure, not a creative toy.

### The three layers (current → near → far)

| Layer | Time horizon | What Pluribus is |
|---|---|---|
| Production platform | Now | End-to-end workflow for creative teams producing AI talent media |
| Rights management system | 12–24 months | System of record for every consent, approval, and licensed export across a brand's talent roster |
| B2B infrastructure / API | 24–48 months | Consent + licensing layer embedded in other creative tools, agency platforms, and brand portals |

---

## 3. Core Strategic Direction

Pluribus must materially improve in seven moat areas:

1. Proprietary workflow orchestration
2. Approval systems
3. Identity consistency
4. Art-direction tooling
5. Asset memory
6. Organizational workflows
7. Talent consent + trust infrastructure — the consent moat is the primary sales wedge and the hardest to copy; it makes Pluribus the legal paper trail for every synthetic likeness produced

The raw image model is not the moat.

The moat is the system around generation:

- repeatable workflows
- persistent identity memory
- structured review
- asset lineage
- campaign organization
- creative direction
- approval history
- team operations

---

## 4. Primary Product Goal

The primary goal is to turn Pluribus into the operating system for commercial identity rights.

**Near term:** The system of record for every synthetic likeness produced — who consented, what was approved, what was exported, under what license.

**Long term:** The infrastructure layer that makes commercial AI use of human likeness legally defensible at scale — for brands, agencies, talent managers, and eventually any platform that touches a human face commercially.

The system should know and remember:

- who the subject is and what they consented to
- what their likeness should look like
- what has been approved by the creative team
- what has been approved by the talent themselves
- what usage licenses have been issued and to whom
- which campaigns the likeness has appeared in
- which exports were delivered and when
- what the talent earned or is owed (monetization layer, Phase 3+)
- which creative direction is brand-safe and on-brief
- which visual systems should be reused across campaigns

---

## 5. Product Principles

### Workflow first, generation second

Generation is only one part of the product.

The product must prioritize:

- setup
- references
- creative direction
- reusable recipes
- review
- approval
- asset memory
- export
- campaign reuse

### Identity persistence is a core moat

Every subject should have a persistent identity profile.

The system should store and reuse:

- reference images
- approved likeness examples
- rejected likeness examples
- facial notes
- body/proportion notes
- hair/beard notes
- skin/tone notes
- tattoos/scars/marks
- wardrobe constraints
- do-not-change rules
- approved angles
- rejected identity traits
- identity confidence notes

### Human approval and curation remain central

Pluribus does not replace creative teams.

It helps creative teams move faster.

Humans should define:

- identity accuracy
- visual direction
- approval decisions
- campaign taste
- final selection

The system should accelerate and organize this process.

### Taste and creative direction must be encoded

The product should not encourage random AI chaos.

It should guide users toward controlled, premium, production-ready visual systems.

### The system should remember what works

Every useful decision should become reusable system knowledge.

This includes:

- successful prompts
- successful recipes
- approved outputs
- rejected outputs
- reviewer notes
- campaign rules
- export presets
- subject-specific constraints

---

## 6. Core Product Objects

Pluribus should be structured around these objects:

### Workspace

A company/team account.

### Project

A client, campaign, event, production cycle, or brand initiative.

### Campaign / Collection

A grouped set of outputs for a launch, announcement, event, or content series.

### Subject

An athlete, artist, creator, model, or brand identity.

### Identity Profile

Persistent visual memory for a subject.

### Creative Recipe

A reusable generation workflow.

Should include:

- recipe name
- use case
- prompt template
- negative prompt
- model/provider preferences
- input requirements
- style rules
- lighting rules
- composition rules
- export formats
- post-processing steps
- quality checklist

Examples:

- Athlete Announcement
- Editorial Portrait
- Match Day Graphic
- Sponsor Campaign
- Broadcast Hero
- Social Teaser
- Press Kit Image
- Motion Reference Still

### Generation Run

A specific execution of a recipe.

Should track:

- subject
- recipe
- prompt
- inputs
- provider/model
- parameters
- outputs
- status
- errors
- created by
- version
- lineage

### Asset

Any generated or uploaded media file.

Should include:

- asset type
- source
- subject
- project
- campaign
- tags
- status
- approval state
- version
- metadata
- storage URL
- thumbnail URL
- parent asset
- generation run
- export formats

### Review

Human feedback on an asset or set.

Should include:

- comments
- review status
- requested changes
- reviewer
- timestamp
- pin/region if possible
- structured feedback actions

### Approval State

Clear production state machine:

- Draft
- Internal Review
- Needs Revision
- Approved
- Athlete Approved
- Sponsor Approved
- Final
- Archived
- Rejected

### Export Preset

Reusable output formats:

- Instagram feed
- Instagram story
- X/Twitter
- LinkedIn
- Web hero
- Press image
- Broadcast still
- LED wall
- Deck image
- Thumbnail

### Organization Roles

8-role model implemented in `app/lib/permissions.ts`:

- `admin` — full workspace control
- `editor` — create campaigns, generate, manage subjects
- `viewer` — read-only access
- `reviewer` — approve/reject outputs, comment
- `subject` — talent-facing portal access (SubjectPortal)
- `subject_manager` — manages talent onboarding and consent
- `legal` — consent record access
- `guest` — external review link access (no login)

---

## 7. Core User Journeys

### Journey 1: Create an athlete identity

1. Create subject
2. Upload references
3. Add identity notes
4. Add do-not-change constraints
5. Mark approved likeness examples
6. Save identity profile

### Journey 2: Create a campaign

1. Create project/campaign
2. Select subject(s)
3. Select creative recipe
4. Generate outputs
5. Review contact sheet
6. Request changes
7. Approve finals
8. Export asset pack

### Journey 3: Reuse a successful workflow

1. Open previous generation run
2. Duplicate recipe/run
3. Swap subject or campaign
4. Preserve art direction
5. Generate new set
6. Compare consistency

### Journey 4: Review assets

1. Open review queue
2. Filter by subject/campaign/status
3. Compare outputs
4. Leave feedback
5. Approve/reject/request revision
6. Track review history

### Journey 5: Search memory

1. Search by subject, campaign, recipe, tag, approval state, or visual notes
2. Open past assets
3. Review lineage
4. Reuse prompt or recipe
5. Export or create new run

---

## 8. UX/UI Direction

The UI should feel like:

- premium creative software
- sports media command center
- Figma/Frame.io-like review layer
- production-grade media infrastructure

It should not feel like:

- generic SaaS dashboard
- consumer AI toy
- prompt playground
- cluttered admin panel

Design principles:

- dark or neutral production-grade interface if already aligned
- strong asset thumbnails
- fast scanning
- large preview modes
- minimal but powerful metadata
- clear production states
- strong filtering
- clear hierarchy
- tasteful typography
- avoid rounded toy-like UI
- avoid loud gradients unless brand-appropriate
- avoid unnecessary decoration
- keep interactions fast and decisive

Important screens:

- Dashboard
- Projects
- Campaign detail
- Subjects
- Subject profile
- Identity profile
- Recipes
- Recipe detail/edit
- Generation run detail
- Asset library
- Asset detail
- Review queue
- Export panel
- Settings / creative constitution

---

## 9. Phase 1 Status — COMPLETE

All Phase 1 features are built and deployed. Summary below for reference.

### 1. Identity Profiles

Minimum requirements:

- subject profile page
- reference upload gallery
- notes and constraints
- approved likeness examples
- rejected examples
- identity checklist
- do-not-alter fields
- basic identity confidence/manual rating
- link assets to subject

### 2. Creative Recipes

Minimum requirements:

- recipe list
- recipe detail page
- create/edit recipe
- prompt template
- negative prompt
- required inputs
- style rules
- model/provider notes
- export intent
- quality checklist
- clone recipe

### 3. Generation Runs

Minimum requirements:

- store prompt, recipe, subject, inputs, outputs, provider, timestamp
- link outputs to source references
- show generation history
- allow rerun or duplicate with changes
- track failed runs if applicable

### 4. Approval System

Minimum requirements:

- asset states
- approve/reject/request changes
- comments
- reviewer name
- review history
- filter by approval state
- batch approve where appropriate

### 5. Asset Memory

Minimum requirements:

- asset detail page
- tags
- subject/project/campaign links
- generation lineage
- status
- source references
- search/filter by subject, project, recipe, status, tag

### 6. Organizational Structure

Minimum requirements:

- workspaces or projects
- subject organization
- campaign/collection structure
- clear navigation
- role-ready architecture even if full permissions are not complete

---

## 10. Phase 2 Status — PARTIALLY COMPLETE

Built:
- [x] Side-by-side asset comparison (ComparePanel)
- [x] External review links (`/review/{token}`, no login required)
- [x] Export packs (Campaign Pack Generator — 4 pack types)
- [x] Quality scoring (resemblance scoring, 5-tier identity score system)
- [x] Identity confidence scoring (Hero/Campaign/Internal/Exploration/Weak tiers)
- [x] Advanced permissions (8-role model, `can()` API, gates on export/approve/member management)
- [x] Talent consent infrastructure (SubjectPortal, consent receipt email, subject approve/reject)

Not yet built:
- [ ] Contact sheet view
- [ ] Batch feedback
- [ ] Structured feedback presets
- [ ] Campaign boards
- [ ] Version history on recipes and subjects
- [ ] AI-assisted tagging
- [ ] AI-assisted recipe recommendations
- [ ] Sponsor-safe review labels
- [ ] Brand safety checklist
- [ ] Members backend (workspace_members table + invite email)

---

## 11. Phase 3 Intelligence Layer

Plan but do not overbuild unless foundations are ready:

- smart model routing
- recipe performance analytics
- "what worked before" recommendations
- automated prompt improvement
- visual consistency scoring
- creative graph
- campaign memory
- cross-subject style normalization

---

## 12. Decision-Making Rules

When choosing what to build, prioritize:

1. Anything that makes Pluribus harder to replace
2. Anything that turns creative knowledge into reusable system knowledge
3. Anything that improves identity consistency
4. Anything that reduces review/approval chaos
5. Anything that helps teams repeat successful outputs
6. Anything that makes the product feel production-grade
7. Anything that improves launch credibility
8. Anything that creates investor/customer proof

Do not prioritize:

- cosmetic dashboards
- generic AI chat features
- consumer-style prompt toys
- overcomplicated model marketplaces
- premature automation
- too many settings
- features that do not support the core workflows

---

## 13. Strategic End State

The end state is that Pluribus becomes the operating system for commercial identity rights — the infrastructure layer that any brand, agency, or creative platform uses to manage AI-generated likeness at scale.

At scale, Pluribus:

- Holds consent records for millions of talent identities
- Manages approval workflows across thousands of campaigns simultaneously
- Issues usage licenses that specify what an AI-generated likeness can and cannot be used for
- Tracks monetization (royalties, usage fees, talent tier pricing) per identity per use
- Exposes all of this as an API that other tools embed rather than rebuild

The product today (campaign production platform) is the wedge that earns trust with brands, agencies, and talent. Every consent signed, every output approved, every licensed export delivered builds the dataset and the credibility that makes the infrastructure play possible.

### The API / B2B Infrastructure Play

Packaging identity capture + consent as an API/SDK is a Phase 3 move, not Phase 1. It requires:

1. Proven consent workflow with multiple paying customers (validates the standard)
2. Legal review of consent record portability and jurisdiction requirements
3. Developer-facing API surface (token issuance, webhook events, rights query)

The signal to start this play: when a second or third customer asks "can we embed this into our existing platform?" instead of using Pluribus directly. That question is the product-market fit signal for the API layer.

Do not build this speculatively. Build it when someone asks for it.