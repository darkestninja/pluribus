# Pluribus Product Principles

## 1. Workflow First

The product should not revolve around a prompt box.

It should revolve around:

- subjects
- identity profiles
- recipes
- campaigns
- assets
- reviews
- approvals
- exports

## 2. Identity Is Persistent

A subject is not just a folder.

A subject has memory:

- references
- likeness rules
- approved outputs
- rejected outputs
- constraints
- history

## 3. Every Output Needs Lineage

Every asset should answer:

- where did this come from?
- who generated it?
- what prompt was used?
- which recipe was used?
- which references were used?
- has it been approved?
- where was it exported?

## 4. Approval Is a Product Feature

Approval should not happen only in Slack, WhatsApp, or screenshots.

The product should support:

- comments
- approval states
- review history
- requested changes
- reviewer attribution

## 5. Taste Is System Logic

Pluribus should guide users away from generic AI imagery.

The product should encourage:

- restraint
- consistency
- controlled lighting
- strong composition
- believable identity
- premium visual direction

## 6. Build for Teams

Even if early usage is solo, architecture should be role-ready.

8-role model live in `app/lib/permissions.ts` (as of Sprint 20):

- `admin` — full workspace control
- `editor` — create/generate/manage
- `viewer` — read-only
- `reviewer` — approve/reject/comment
- `subject` — talent portal access
- `subject_manager` — talent onboarding and consent management
- `legal` — consent record access
- `guest` — external review link, no login

## 9. Every Output Is a Rights Object

A generated image is not just a creative asset. It is a commercial rights object.

It has an owner, a consent record, a set of permitted uses, and an audit trail.

Pluribus must make it impossible to produce a commercially usable output without a corresponding rights record attached to it.

Build toward: consent → approval → license issuance as a single unbroken chain.

## 10. Build Infrastructure, Not Just Features

The long-term play is not a better app. It is becoming the infrastructure layer.

When Pluribus is working, other creative tools — Figma plugins, agency platforms, brand portals — should want to embed the consent and rights layer rather than rebuild it.

Prioritize: standards, APIs, webhook events, portable consent records.

Do not optimize for: proprietary lock-in through UX complexity, dashboard sprawl, features that are hard to package as API primitives.

## 11. Talent Consent Is a Product Feature

The approval flow is not a checkbox.

It is the core trust transaction between the platform, the creative team, and the talent.

Pluribus should:

- make consent legible to talent (plain language, scope selection)
- give talent control over their likeness approvals
- create an auditable paper trail for every synthetic output
- surface consent status throughout the creative workflow
- block export on pending or rejected subject approval

This is the primary moat. It is also the hardest thing to copy quickly.

## 7. Preserve Existing Generation

Do not break the current generation pipeline unless explicitly working on it.

Wrap, extend, and document before replacing.

## 8. Prefer Useful Memory Over More Buttons

The best features are not always new controls.

The best features often help the system remember:

- what worked
- what failed
- who approved what
- which style belongs to which campaign
- which subject traits must not change