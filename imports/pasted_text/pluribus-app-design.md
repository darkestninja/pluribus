# Pluribus — Figma Make Prompt

---

Design a modern, professional web application called **Pluribus** — an AI-powered athlete imagery generation studio used by sports organizations (clubs, leagues, agencies, broadcasters) to rapidly produce on-brand visual assets from a single source athlete capture.

## Product context

Each athlete is onboarded once through a detailed capture session: front, left, right, and back stills, a 360° turntable video, plus metadata (scars, tattoos, hair, skin tone, build, kit/uniform, sponsors). Pluribus then uses this capture as the source-of-truth identity, and a node-based generation engine (Weavy-style) on the backend turns that identity into finished assets — announcement graphics, lineup cards, matchday hype posts, signing reveals, transfer reveals, intro stings, mini videos for stadium LED ribbons and concourse screens, social campaign sets, and more.

The Figma Make output should be the **end-user front end** that sits on top of that node backend. Users do NOT see the raw node graph. Instead, they work inside curated **Workspaces** (e.g. "Signing Announcements — Spring Campaign," "Matchday Hype — Home Kit," "Player of the Month") that wrap a backend node graph with a clean, opinionated UI, preset prompts, and a small set of controls.

## Core information architecture

Build the following primary surfaces:

**1. Dashboard / Home**
- Greeting header with org logo and user avatar (top right)
- "Create new Workspace" primary action card
- Recent Workspaces grid — each card shows workspace name, thumbnail of the most recent render, athlete avatar stack, asset count, last edited timestamp
- "Athletes" section — horizontally scrolling roster of captured athletes with status badges (Capture complete / Capture pending / Needs review)
- Quick stats strip: assets generated this month, renders queued, average render time

**2. Athlete Library**
- Grid of athlete cards. Each card: hero portrait, name, position, jersey number, capture status, "Open capture" button
- Detail view (when an athlete is opened): tabs for Capture (front/left/right/back stills + 360 video player), Identity Notes (scars, tattoos, hair, build), Brand Assets (kits, sponsor patches), and History (every asset ever generated featuring this athlete)

**3. Workspace (the main creative surface — most important screen)**

This is where users spend 90% of their time. Layout:

- **Left rail (collapsible, ~280px)** — Prompt Library
  - Tabs: Presets, Styles, My Prompts
  - Vertical list of preset prompt cards. Each card has: thumbnail render, name (e.g. "Cinematic Signing Reveal," "Heroic Low-Angle Portrait," "B&W Editorial," "Neon Hype Drop," "Vintage Trading Card," "Minimalist Lineup," "Stadium Smoke Atmosphere"), short tag row showing aspect ratio and style family
  - Each preset is a pre-written prompt template under the hood — clicking applies it to the canvas
  - Search bar at top, filter chips below (Portrait, Action, Group, Announcement, Editorial, Social-square, Story-vertical, LED-ribbon)
  - "+ Custom prompt" button at bottom

- **Center canvas** — Generation surface
  - Large preview area showing the active render with a subtle checkerboard or neutral background
  - Above the canvas: breadcrumb (Org › Workspace name › Asset name) and a tab bar for multiple open assets within the workspace (like browser tabs)
  - Below the canvas: a horizontal **variation strip** showing 4–6 generated variations the user can click to promote to main
  - Floating action bar above the canvas (centered, pill-shaped): Undo, Redo, Regenerate, Compare A/B, Fullscreen
  - When idle (no render yet), the canvas shows an empty state with a large "Drop an athlete here or pick from the roster" affordance and a horizontal athlete picker

- **Right rail (~340px)** — Controls panel, organized in collapsible sections:
  1. **Athlete** — selected athlete chip (with "swap" action), kit/uniform variant dropdown, expression preset (Neutral, Confident, Intense, Celebration), pose preset
  2. **Prompt** — the active prompt as editable text in a styled textarea, with a "Reset to preset" link and a small "Advanced" toggle that reveals negative prompt + seed
  3. **Style controls** — segmented control for color treatment (Color / B&W / Duotone / Sepia), intensity slider, mood slider (Cinematic ↔ Editorial ↔ Hype)
  4. **Output** — aspect ratio segmented control (1:1, 4:5, 9:16, 16:9, 21:9, LED custom), resolution segmented control (2K / 4K / 8K), format (PNG / JPG / MP4 for motion presets)
  5. **Photo adjustments** — simple sliders only: Exposure, Contrast, Saturation, Warmth, Grain, Vignette. Keep these intentionally minimal — a "Reset adjustments" link sits at the bottom
  6. **Layers / Template** (only visible when a template is active — see below)
  - A primary "Generate" button pinned to the bottom of the right rail, full width, with a secondary "Generate batch (×4)" button below it, and a small queue/credits indicator

**4. Template editor (lightweight Canva-style mode)**
- Triggered by an "Open in Template" button when a render is selected
- The center canvas gains a layer system: the generated athlete cutout becomes one layer; users can add Text, Shape, Logo, Sponsor lockup, and Image layers
- Right rail switches to layer properties (font, weight, size, color, alignment, stroke, shadow, blend mode, opacity, rotation)
- Left rail switches to a Templates browser — pre-built announcement layouts ("Signing Reveal — Bold," "Player of the Match — Editorial," "Matchday Lineup — Grid," "Transfer Reveal — Cinema," "Birthday — Celebration"). Each template is a layered file the user drops their generated athlete into
- Keep this intentionally simple — no advanced vector editing, no path operations. Just text, basic shapes, alignment, layer order, and a small library of brand-safe assets (org logos, sponsor logos, kit patterns, league marks)
- Top toolbar: alignment controls, distribute, group, lock, layer order, snap toggle

**5. Render queue / History**
- Side drawer accessible from any screen
- Vertical list of past and in-progress renders with status (Queued / Rendering 47% / Done / Failed), thumbnail, prompt summary, athlete, timestamp, and a re-run / duplicate / download / delete action menu

**6. Settings**
- Account, Org branding (upload logo, primary/secondary brand colors that flow into templates), Team members, API + integrations, Theme (Light / Dark / System), Billing/credits

## Visual design direction

- Aesthetic: confident, sports-broadcast-inspired, premium. Think a cross between Linear, Runway, and a modern broadcast graphics package. Editorial, not toy-like.
- Typography: a clean grotesque for UI (something in the spirit of Inter, Söhne, or General Sans), and a sharper display face used sparingly for big numbers, athlete names, and section heroes
- Spacious 8px grid, generous padding inside cards, soft 12–16px corner radius on cards and inputs, 20–24px on hero cards
- Clear visual hierarchy. Use weight and size more than color to establish hierarchy
- Iconography: stroke icons, 1.5px weight, consistent with Lucide

## Theme — must support both Dark and Light

Design **both** themes as first-class. Build a toggle in the top bar.

**Dark mode (default for the launch screen)**
- Background: near-black with a faint warm tint (#0B0B0F)
- Surface: #15151B
- Elevated surface: #1E1E26
- Borders: #2A2A33, hairline 1px
- Text primary: #F4F4F6
- Text secondary: #9A9AA6
- Accent: a single confident color — pick a vivid stadium-floodlight accent (e.g. an electric lime #C6FF3D or a hot orange #FF6A1A). Use it sparingly — primary CTAs, active states, the canvas focus ring, the generate button. Most of the UI is monochrome.

**Light mode**
- Background: #F7F7F8
- Surface: #FFFFFF
- Borders: #E5E5EA
- Text primary: #0E0E12
- Text secondary: #5A5A66
- Same accent color used at slightly lower saturation

## Components to design explicitly (as Figma components with variants)

- Button (primary, secondary, ghost, destructive; sizes sm/md/lg; with-icon variant; loading state)
- Input, Textarea, Select, Slider, Segmented control, Toggle, Checkbox, Radio
- Card (workspace card, athlete card, prompt preset card, template card)
- Tag / chip (filter chip with selected state)
- Tab bar (canvas tabs and rail-section tabs)
- Athlete avatar (with capture-status ring)
- Prompt preset card (thumbnail + label + tag row)
- Right-rail collapsible section header
- Floating action bar pill
- Toast / notification
- Modal (used for "Create workspace," "Invite member," "Confirm delete")
- Empty states (workspace with no renders, athlete library empty, queue empty)
- Loading / shimmer skeletons for the canvas and cards

## Specific screens to deliver as frames

1. **Dashboard — Dark mode**
2. **Workspace — Dark mode** with an athlete loaded, a preset selected, a finished render on canvas, four variations in the strip, all right-rail sections expanded
3. **Workspace — Template editor mode — Dark mode** showing layers panel and a signing-announcement template populated with a generated athlete, athlete name, jersey number, and team logo
4. **Athlete library — Dark mode**
5. **Athlete detail — Capture tab — Dark mode**
6. **Workspace — Light mode** (mirror of frame 2 to prove the theme works)
7. **Render queue drawer — Dark mode**
8. **Empty state — new workspace — Dark mode**
9. **Mobile/tablet condensed view** of the workspace screen — left rail becomes a bottom sheet, right rail becomes a slide-up panel, canvas takes the full width

## Microinteractions and details to suggest

- Generate button shows a subtle progress shimmer along its border while a render is in flight
- Variation strip thumbnails have a hover state that lifts and glows in the accent color
- Hovering a prompt preset card briefly auto-plays a 2-second loop of the example render style
- Right rail sections animate open/closed with a soft spring
- Theme toggle morphs between sun and moon icon
- The canvas focus ring pulses gently in the accent color during active renders
- Aspect ratio control visually morphs the canvas frame when changed

## What to avoid

- No node-graph UI, no wires, no canvas-of-nodes. The backend is node-based, but the user-facing surface is opinionated and clean.
- No heavy Photoshop-style adjustment panels. Keep photo adjustments to the six listed sliders.
- No vector pen tool, no path editing, no advanced typography panel. The template editor is intentionally Canva-light.
- No clutter. Density should feel premium, not crowded. When in doubt, give it more air.

## Tone of UI copy

Confident, sport-broadcast cadence, never cute. Examples:
- Empty workspace: "Pick an athlete. Pick a look. Ship it."
- Generate button: "Generate" / when batch: "Generate ×4"
- Render queue header: "In flight"
- Capture missing: "Capture pending — book a session"

---

Deliver the design as a full Figma file with the frames listed above, components organized in a library page, and both Dark and Light theme styles published as variables.