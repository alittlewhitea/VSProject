# DreamFace — DESIGN.md

> Version: 1.0 · Direction: Editorial AI Studio / Premium Creative Workspace
> Purpose: Redesign the EXISTING DreamFace UI without changing application capabilities, routes, data contracts, pricing logic, or authentication behavior.
> Status: Proposed design system; tokens below are creative recommendations for DreamFace, **not** exact brand tokens from any third-party website.

## 1. Design references and synthesis

Reference websites for visual decisions (study principles; do not duplicate site artwork, logos, unique layouts, or licensed fonts):
- ElevenLabs — https://styles.refero.design/style/031056ff-7af1-46db-8daa-115f731c5d26 — restrained editorial typography, warm off-white surfaces, quietly premium cards.
- Figma — https://styles.refero.design/style/5fd3b3b4-02ab-456a-87aa-e4395636b671 — artwork-first creative surface, focused accent, clear hierarchy.
- Raycast — https://styles.refero.design/style/3b6a17f0-3bdf-418c-a95e-0b89e5a8b2f8 — precise dark surfaces for preview canvas and technical controls.

**Fusion**: Bright, refined creative studio shell + high-contrast dark preview stage. Maintain DreamFace brand identity and existing logo assets.

## 2. Core principles

1. **Content is hero.** User-created videos and images should attract attention before UI decorations.
2. **Calm, not empty.** Use purposeful density, typography and alignment instead of lots of indistinguishable white space.
3. **Professional but approachable.** Avoid the generic purple-gradient AI dashboard, flashy neon, and excessive frosted glass.
4. **Visible cost and control.** Keep model, settings, duration, resolution, aspect ratio, approximate credits and generate action clear.
5. **Reusable consistency.** Build and use one tokenized system across Home, Video, Image, Audio, AI Talking, Projects and Billing.
6. **Progressive disclosure.** Show essential controls first; advanced options remain discoverable but not visually loud.

## 3. Proposed tokens

### Color palette — light shell

| Token | Value | Role |
|---|---|---|
| `--df-bg` | `#F7F7F9` | Main application background |
| `--df-surface` | `#FFFFFF` | Input panels and primary cards |
| `--df-surface-soft` | `#F0F0F4` | Secondary cards and hover surfaces |
| `--df-surface-warm` | `#F9F7F4` | Editorial homepage accent sections |
| `--df-ink` | `#20212B` | Titles and body text |
| `--df-muted` | `#727586` | Secondary descriptions |
| `--df-faint` | `#9497A6` | Tertiary captions / placeholders |
| `--df-border` | `#E6E7EC` | Delicate borders and separators |
| `--df-primary` | `#6947E8` | Primary CTA and selected states |
| `--df-primary-hover` | `#5838CD` | CTA hover |
| `--df-primary-soft` | `#F0EBFE` | Subtle selection highlight |
| `--df-success` | `#13856A` | Status meaning only |
| `--df-error` | `#C34356` | Error meaning only |

These colors are **suggested** for the rebuild and must be reconciled with any existing brand tokens. Keep the existing DreamFace green logo unchanged unless separately approved; the purple action system can coexist with it.

### Dark preview stage

| Token | Value | Role |
|---|---|---|
| `--df-stage` | `#111318` | Video/image preview background |
| `--df-stage-elevated` | `#1C1F27` | Player controls / media tray |
| `--df-stage-border` | `#30343D` | Dark-mode dividers |
| `--df-stage-text` | `#F5F6FA` | Primary text on dark canvas |
| `--df-stage-muted` | `#AAAEBB` | Secondary stage captions |

Do **not** apply the dark stage to every panel. The creative artifact should feel visually framed, not trapped in a uniformly dark app.

### Typography

- Prefer `Inter` for UI with system-ui fallbacks. Use licensed/available fonts only.
- Heading 1: `40px / 48px / 600 / -0.035em` on desktop home; scale down responsibly on small screens.
- Heading 2: `24px / 30px / 600 / -0.02em`.
- Workspace page title: `22px / 28px / 600`.
- Card heading: `16px / 24px / 600`.
- Body: `14px / 22px / 400`.
- Labels: `12–13px / 18px / 500`.
- Metadata and credit details: `12px / 18px / 400`.
- Avoid excessive bolding. Establish hierarchy with scale, tone, spacing and information grouping.

### Spacing and geometry

- Base spacing: `4px`; preferred gaps: `8 / 12 / 16 / 20 / 24 / 32 / 48 / 64px`.
- Sidebar desktop width: approximately `208–224px`.
- App header desktop height: approximately `64–72px`.
- Content horizontal gutter: `24–32px` desktop; `16px` mobile.
- Panel/card radius: `14px`; input radius: `12px`; button radius: `10px`; chips: `999px`.
- Hairline border: `1px solid var(--df-border)`.
- Shadows: use sparingly, mostly for popovers, dialogs and a few elevated visual cards; no heavy shadows on every panel.
- Button height: `40–44px`; important primary Generate CTA may be `48px`.

## 4. Information architecture — preserve existing app

Navigation must remain functional and recognizably organized:
- Home
- Video
- Image
- Audio
- AI Talking
- Projects
- Billing

Header functions retained:
- Theme control, credit balance, Buy credits, language dropdown, account/sign-in state.

Do not remove existing routes, backend calls, uploads, pricing, jobs or sample media logic. The visual refactor must use real existing data and behavior rather than static placeholders.

## 5. Home page

### Structure

1. Clean persistent sidebar + light application header.
2. Hero: confident, compact title and one clear supporting sentence (avoid oversized empty space).
3. Primary multi-modal creation composer: meaningful prompt input, content type tabs (Video, Image, Audio), upload/media affordance, dominant Start creating action.
4. Featured inspiration gallery: cinematic cover images with consistent aspect ratio and overlay typography; high-quality thumbnail crop; hover actions 'Preview' and 'Use this style' if the product actually supports them.
5. Recent projects: compact card list/grid with useful metadata and real resume action.

### Visual direction

- Use selective editorial contrast: warm near-white hero canvas, dark headings, subtle violet product highlights.
- Prefer a well-composed 3-column creative gallery to giant whitespace. Adapt grid responsively.
- Samples must not contain visible third-party broadcast watermarks unless properly sourced and authorized; avoid sample items that imply endorsement.
- Do not copy the precise artwork used by Refero source websites.

## 6. Video generation workspace

### Desktop layout

- Sidebar app navigation remains in place.
- Under a compact top title/header, use two primary columns:
  - **Left inspector**: approximately 36–40% of usable workspace, with sensible width constraints.
  - **Right stage**: approximately 60–64%, optimized for media preview and variations.
- Both columns should visually align at top with consistent vertical spacing.
- When available, allow practical scrolling so the Generate CTA does not disappear during long configuration.

### Left inspector content — preserve the observed functions

- Text to Video / Image to Video tab switch.
- Real prompt textarea with comfortable editing space, character count (if supported), AI Enhance, Inspire me and Clear.
- Explicit state-dependent reference upload: do not show image upload as mandatory when in text-only mode.
- Model picker card: model name, speed/quality summary, 'Change' action, actual pricing computed from current parameters.
- Duration, aspect ratio, quality; advanced settings as a collapsible section.
- Primary generation CTA with clear estimated credit cost and account/sign-in state.
- Credit estimate help text subordinate to the primary CTA.

### Right stage

- Preview area uses `--df-stage` with generous video space and unobtrusive controls.
- Preserve video preview/play/pause/volume/fullscreen behaviors where implemented.
- Samples/variations are a restrained horizontal thumbnail rail with clear selected treatment and duration metadata.
- Put secondary actions (open preview, download, regenerate, create from result) near the media where capabilities exist; do not invent disconnected dummy buttons.
- Handle idle, loading, success, failed and empty-result states with truthful UI.

### Interaction hierarchy

1. Prompt input.
2. Model and essential parameters.
3. Cost + Generate.
4. Generated output and next action.

## 7. Component rules

- **Sidebar**: quiet base; active state shown with tinted `--df-primary-soft` and sharp contrast, not a huge heavy pill.
- **Primary button**: solid brand purple, white label, no gradient. One major CTA per functional region.
- **Secondary button**: white/subtle gray fill with 1px border, calm hover treatment.
- **Inputs**: clear labels, adequate active/focus styles, meaningful placeholder and helper text.
- **Model card**: one emphasized selected style; show what model does and actual cost, avoid random badges.
- **Media tile**: consistent radius, aspect ratio and overlays; preserve thumbnail crop.
- **Popovers/dialogs**: accessible focus, robust z-index, readable contrast, keyboard use.
- **Notifications**: loading/error/success states should be semantic, not cosmetic.

## 8. Motion and feedback

- Functional hover transition: `120–180ms` ease-out.
- Overlay and dialog entrance: `180–240ms` restrained ease-out.
- Use shimmer/skeleton only for genuinely loading data.
- No infinite glowing borders, parallax on workspace controls, or looping distracting gradients.
- Respect `prefers-reduced-motion`.

## 9. Responsive behavior

- ≥1280px: persistent sidebar and side-by-side inspector + stage.
- 768–1279px: compact/collapsible sidebar, more constrained inspector while protecting preview width.
- <768px: stacked layout, creation controls above preview; accessible collapsible nav, no horizontal overflow.
- Preserve tap targets (recommended ≥44px for primary touch actions) and visible labels.

## 10. Accessibility and quality bar

- Aim for WCAG AA contrast and visible keyboard focus.
- Use semantic HTML and correct interactive element types.
- Keep labels connected to inputs; no icon-only ambiguous controls without accessible names.
- Avoid layout shift, broken aspect ratios, clipping in smaller windows.
- Preserve English/other locale support; UI copy should remain short and translatable.
- Never expose secret tokens or change API auth while redesigning.

## 11. Anti-patterns — do not do these

- Do not rebuild as a generic analytics dashboard.
- Do not add decorative chart/KPI cards irrelevant to video creation.
- Do not introduce mixed rounded-corner systems or random gradients.
- Do not turn every surface purple or dark.
- Do not change real price calculations to hard-coded illustrative values.
- Do not replace working interactions with dummy buttons or fake generated examples.
- Do not switch to an unlicensed custom font used by a reference brand.
- Do not reproduce an existing website exactly.

## 12. Agent implementation protocol

1. Read existing project structure, design tokens, UI component conventions, routes and state management before editing.
2. List the main pages/components affected and explicitly state what behavior will stay unchanged.
3. Create reusable color/type/spacing tokens and a small component layer before page-level styling.
4. Refactor **Home** and **Video** first. Follow with the remaining pages only after shared components are stable.
5. Use screenshots provided by the user as **before** references, not pixel-perfect desired outputs.
6. Keep working model selection, pricing, credits, prompts, uploads, playback, auth, language and navigation intact.
7. Run the actual project's build/type checks and any available tests, and fix issues.
8. Provide a concise change summary and screenshots/previews when feasible.

**Definition of done:** DreamFace should feel like a premium creative studio, not a stock admin template; its existing workflows must continue to function end-to-end.
