# Landing Page Redesign Spec

## Summary

Replace the current landing page with a new design from Figma (frame `Writer Computer`, 1512×993). The new layout is a single dark viewport: a pixel-W brand mark with an orange accent rule at top-left, two pill nav buttons at top-right, a large 48px headline with a dark download pill on the left, a 5-row label+description feature list below the hero, and a tall stacked screenshot column on the right.

This spec captures pixel-level intent from the Figma file. The implementation should reproduce these tokens exactly at the 1512px breakpoint and degrade gracefully below.

## Goals

- Replicate the Figma layout 1:1 at the 1512×993 reference size.
- Preserve the visual hierarchy on smaller screens by stacking the screenshot column below the hero on narrow viewports.
- Keep the implementation lean — no extra component library, no new dependencies, plain CSS continues to be enough.
- Reuse the existing build-time wiring for version + DMG URL.

## Non-Goals

- No new dependencies (no Tailwind, no UI library, no SF Pro web font).
- No additional sections beyond what the Figma frame contains.
- No carousels, no hover-only reveals, no scroll-triggered animation in v1.
- No mobile-specific redesign — only responsive collapse.

## Reference

Figma frame: `Writer Computer` (id `212:399`).

## Canvas

| Attribute       | Value                                                                                                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frame width     | 1512px                                                                                                                                                                  |
| Frame height    | 993px                                                                                                                                                                   |
| Background fill | `#121212` (rgb 18,18,18 — solid)                                                                                                                                        |
| Corner radius   | 0                                                                                                                                                                       |
| Layout          | Free-form absolute positioning; conceptually a 3-row × 2-column grid (header / hero+features / footer-empty) with the screenshot column spanning all rows on the right. |

The frame is **single-viewport** at 1512×993 — there is no scroll at the design size. The screenshot column extends beyond the bottom of the frame and is intentionally cropped (see "Screenshot column" below).

## Color Tokens

Pulled from the Figma fills, expressed as hex / rgba.

| Token                  | Value                     | Usage                                                                                                     |
| ---------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------- |
| `--bg`                 | `#121212`                 | Page background                                                                                           |
| `--surface`            | `#323232`                 | Download button, Alpha pill                                                                               |
| `--surface-screenshot` | `rgba(217,217,217,0.20)`  | The three screenshot placeholders (light grey at 20% over the dark bg → renders as a soft graphite panel) |
| `--ink`                | `#FFFFFF`                 | All primary text, logo glyph                                                                              |
| `--ink-80`             | `rgba(255,255,255,0.80)`  | "Alpha" label inside the version pill                                                                     |
| `--ink-60`             | `rgba(255,255,255,0.60)`  | "Free and open source. Forever" caption                                                                   |
| `--ink-50`             | `rgba(255,255,255,0.50)`  | Feature descriptions, "v0.0.11" version number                                                            |
| `--stroke-ghost`       | `rgba(255,255,255,0.12)`  | GitHub nav button outline                                                                                 |
| `--accent`             | `#E17909` (rgb 225,121,9) | The single orange vertical line next to the logo                                                          |

There is **one chromatic accent** in the entire design — the orange rule next to the logo. Everything else is white-on-near-black with opacity steps.

## Type System

Single family throughout: **SF Pro Display** (system-ui on Apple platforms). On non-Apple platforms fall back to `system-ui, -apple-system, "Segoe UI", sans-serif`. Do not load a web font.

All line-heights are **100%** (1.0) in the source. Letter-spacing is `0%` everywhere except the headline.

| Role                    | Font           | Size     | Weight            | Line        | Letter-spacing     | Color      |
| ----------------------- | -------------- | -------- | ----------------- | ----------- | ------------------ | ---------- |
| Headline                | SF Pro Display | **48px** | **Regular (400)** | 100% (48px) | **-2% (~-0.96px)** | `--ink`    |
| Nav button label        | SF Pro Display | 14px     | Medium (500)      | 100%        | 0                  | `--ink`    |
| Download button label   | SF Pro Display | 14px     | Medium (500)      | 100%        | 0                  | `--ink`    |
| Feature label           | SF Pro Display | 16px     | Regular (400)     | 100%        | 0                  | `--ink`    |
| Feature description     | SF Pro Display | 16px     | Regular (400)     | 100%        | 0                  | `--ink-50` |
| "Free and open source." | SF Pro Display | 12px     | Medium (500)      | 100%        | 0                  | `--ink-60` |
| "v0.0.11"               | SF Pro Display | 10px     | Medium (500)      | 100%        | 0                  | `--ink-50` |
| "Alpha" (inside pill)   | SF Pro Display | 10px     | Medium (500)      | 100%        | 0                  | `--ink-80` |

Authority comes from size + the -2% tracking on the headline, **not** from weight. The 48px headline is Regular, not Bold.

## Layout & Coordinates (1512 reference)

Everything is positioned absolutely in the source. The implementation should still use flow / flexbox where it produces the same visual result, but these are the exact reference coordinates.

```
+----------------------------------------------------------------------------+
| [logo @ 30,37]                                  [Updates ][ GitHub  ] @ 646,36
|                                                                            |
|                                                  +----------------------+  |
|                                                  |                      |  |
|                                                  | screenshot 1         |  |
|   [Headline @ 32,115, 619×96, two lines]         | 610×420 @ 897,4      |  |
|                                                  |                      |  |
|                                                  +----------------------+  |
|                                                  +----------------------+  |
|   [Download for MacOS] [Alpha] v0.0.11           | screenshot 2         |  |
|   x=32,y=236                                     | 610×420 @ 897,429    |  |
|   Free and open source. Forever                  +----------------------+  |
|   x=32,y=301                                     +----------------------+  |
|                                                  | screenshot 3         |  |
|                                                  | 610×420 @ 897,854    |  |
|                                                  | (cropped to ~139 by  |  |
|                                                  |  the 993 viewport)   |  |
|   [features list, 5 rows @ 32,830 → 962]                                   |
|     Private                all your documents live in your computer        |
|     Blazing fast           cold starts takes a fraction of a second        |
|     Extended markdown      mermaid charts, tables and HTML                 |
|     Multiwindow            snappy switch between multiple workspaces       |
|     Lightweight            small binary size <10mb                         |
+----------------------------------------------------------------------------+
```

### Page gutters

- **Left gutter:** `32px` (logo, headline, button, features)
- **Top gutter:** `36–37px` (logo and nav baseline)
- **Right gutter:** `5px` (the screenshot column ends at x=1507; frame is 1512 → 5px gap on the right edge)

### Vertical rhythm in the left column

| y   | Element                                                                                                    |
| --- | ---------------------------------------------------------------------------------------------------------- |
| 37  | Logo top                                                                                                   |
| 75  | Logo bottom                                                                                                |
| 115 | Headline starts                                                                                            |
| 211 | Headline ends (96px tall, two lines)                                                                       |
| 236 | Download button top (gap 25px from headline)                                                               |
| 276 | Download button bottom                                                                                     |
| 301 | "Free and open source." caption top (gap 25px)                                                             |
| 313 | Caption bottom                                                                                             |
| 830 | Features list top (large empty space between caption and features — this is the design's "breathing room") |
| 962 | Features list bottom                                                                                       |

The ~520px gap between the caption (y=313) and the features list (y=830) is **intentional negative space**. It pushes the features into the bottom-left corner so they read as a footer-anchored list rather than as part of the hero.

## Components

### 1. Logo (top-left)

A two-part lockup:

- **Mark "w"** — a pixel/8-bit style lowercase `w` glyph, white fill, **26.24 × 18.04**, positioned at `(30.36, 48.60)`. The mark is constructed from a stepped vector path that reads as five vertical strokes joined at the bottom. It's deliberately blocky — picture a `w` drawn on graph paper at 1px grid resolution, scaled up. Implement as inline SVG; do **not** approximate with text.
- **Accent rule** — a 2px vertical line, color `--accent` (`#E17909`), 38px tall, positioned at `(56, 37)`. It sits to the immediate right of the mark with ~0px gap and visually anchors the brand to the page edge.

Total bounding box: 26.64 × 38, at `(30.36, 37)`.

The orange rule is the **only** chromatic accent in the entire page. Don't add more.

### 2. Nav (top-right)

Two pill buttons sitting in a row, gap **0px** (they touch). Both **107 × 40**, radius **12**, vertically centered at y=36.

| Button  | Fill               | Stroke                             | Label                         | Label position                                                         |
| ------- | ------------------ | ---------------------------------- | ----------------------------- | ---------------------------------------------------------------------- |
| Updates | none (transparent) | none                               | "Updates", 14px Medium, white | x=27.5, y=13 inside the pill (label width 52, so right padding ≈ 27.5) |
| GitHub  | none               | 1px `--stroke-ghost` (white @ 12%) | "GitHub", 14px Medium, white  | x=33, y=13 inside the pill                                             |

Both pills have the same dimensions — only the GitHub one carries a hairline white outline. **Updates has no visible boundary** at rest; it's only a tap target. Hover treatment isn't specified — pick a subtle brightness shift (see Open Questions).

### 3. Headline

Single text block, two lines:

> **Fast and lightweight app for your workspace's markdown files**

- 48px / Regular / -2% tracking / line-height 100%
- White
- Width box: 619px (forces the wrap; the natural break lands after "for")
- Position: `(32, 115)`, height 96 (two lines of 48px)

The width box is what produces the wrap. Implement with `max-width: 619px` (or the responsive equivalent). Do not insert a hard `<br>` — let the natural wrap happen.

### 4. Download CTA cluster

Three pieces sitting on the same baseline (button center y=256):

#### a. Download button

- **186 × 40**, radius **12**, fill `--surface` (`#323232`)
- Position: `(32, 236)`
- Inner content:
  - **Apple glyph** (12 × 14, white) at `(44, 249)` — `12px` left padding, vertically centered
  - **Label** "Download for MacOS" at `(68, 249)`, 14px Medium white
- Right padding inside the button: ~22px

The Apple glyph is the standard macOS "" mark — implement as inline SVG. Do not use the rendered emoji glyph (font fallback risk).

#### b. Alpha pill

- **37 × 16**, radius **12** (so it's a stadium / oval — radius equals half-height), fill `--surface` (`#323232`)
- Position: `(234, 248)` — sits 16px to the right of the download button, centered on the button's vertical midline
- Inner label: **"Alpha"**, 10px Medium, white at 80% opacity, at `(239, 250)`

#### c. Version label (outside the pill)

- Plain text **"v0.0.11"**, 10px Medium, white at 50% opacity
- Position: `(278, 251)` — 7px gap to the right of the Alpha pill

The implementation should pull `v0.0.11` from `tauri.conf.json` at build time (existing wiring already does this — bind the value to `__WRITER_VERSION__`).

#### d. Free + OSS caption

- **"Free and open source. Forever"**
- 12px Medium, white at 60% opacity
- Position: `(32, 301)` — 25px below the bottom of the download button, left-aligned with the headline

### 5. Features list (bottom-left)

Five rows, each row is `[label]   [description]` on a single baseline. Rows stack with **29px** vertical step (16px row + 13px gap).

| y   | Label             | Label width | Description                               | Description x |
| --- | ----------------- | ----------- | ----------------------------------------- | ------------- |
| 830 | Private           | 46          | all your documents live in your computer  | 86            |
| 859 | Blazing fast      | 77          | cold starts takes a fraction of a second  | 115           |
| 888 | Extended markdown | 138         | mermaid charts, tables and HTML           | 173           |
| 917 | Multiwindow       | 86          | snappy switch between multiple workspaces | 121           |
| 946 | Lightweight       | 80          | small binary size <10mb                   | 115           |

All labels and descriptions are 16px Regular. Labels are full-white; descriptions are at `--ink-50` (50% white).

The label and description are **not** column-aligned — the description starts a few px after the label ends with a small consistent gap (≈ 3–8px in the source; treat as **8px** in the implementation for consistency). Render each row as a flex row with `gap: 8px`.

The descriptions intentionally read as quiet inline subtitles, not as a definition list.

### 6. Screenshot column (right)

Three rectangles stacked vertically, each **610 × 420**, fill `--surface-screenshot` (light grey at 20% over the dark bg → renders as a soft graphite panel).

| Index | y position | Visible portion                                                               |
| ----- | ---------- | ----------------------------------------------------------------------------- |
| 1     | 4          | 4 → 424 (full 420 visible)                                                    |
| 2     | 429        | 429 → 849 (full 420 visible, gap 5 below #1)                                  |
| 3     | 854        | 854 → 1274 in source, **cropped at 993** by the viewport → only 139px visible |

**Gap between panels: 5px.**

The third panel is **intentionally cropped** — only the top ~139px shows. This signals "more content below" without committing to scroll. In the implementation, render the third panel at full height (420) and let the page-level `overflow-hidden` (or the natural fold) crop it.

These rectangles are **placeholders for product screenshots**. The implementation should render them as captioned image slots with the same dimensions and surface treatment, ready to receive real screenshots later. Recommended slot names:

1. `editor.png` — main editor view
2. `palette.png` — command palette / fuzzy search
3. `multi-window.png` — multi-window layout

Until real screenshots exist, render the panels as a soft graphite surface (`--surface-screenshot`) with no border, no caption, no skeleton — exactly as the Figma frame shows.

## Spacing Scale

Apparent values used in the design:

| Token    | Value       | Usage                                                    |
| -------- | ----------- | -------------------------------------------------------- |
| `--s-1`  | 4px         | Frame top edge to first screenshot                       |
| `--s-2`  | 5px         | Gap between screenshot panels, right gutter              |
| `--s-3`  | 7px         | Gap between Alpha pill and v-number                      |
| `--s-4`  | 8px         | Gap between feature label and description (normalized)   |
| `--s-5`  | 12px        | Corner radius (used everywhere)                          |
| `--s-6`  | 16px        | Gap between download button and Alpha pill               |
| `--s-7`  | 25px        | Gap between headline → button → caption                  |
| `--s-8`  | 29px        | Vertical step between feature rows (16px row + 13px gap) |
| `--s-9`  | 32px        | Left page gutter                                         |
| `--s-10` | 36px / 37px | Top page gutter                                          |

## Surfaces

- **Border-radius:** `12px` on all rounded elements (buttons, pills, screenshots have `0`).
- **Box shadow:** none anywhere in the source.
- **Borders:** only the GitHub button has a hairline (`1px solid rgba(255,255,255,0.12)`).
- **Gradients:** none.
- **Texture / noise:** none.

## Tone

Quiet, dark, technical. The "Writer Computer" label feels like a name ("Writer for Computer") rather than a tagline — it's the wordmark, not a sentence. The headline does the selling. The orange rule is the only flourish.

Approach the build like a well-typeset terminal application: lots of negative space, one accent, plain mono-feeling weights, no rounded extravagance.

## Implementation Plan

Replace the current `apps/website/src/App.tsx` and `styles.css` with the new design. Reuse:

- `index.html`, `vite.config.ts`, `tsconfig*.json` (no changes)
- The build-time `__WRITER_VERSION__` / `__WRITER_DMG_URL__` / `__WRITER_REPO_URL__` injection
- The `apps/website/src/components/Mark.tsx` file (rewrite the `WriterMark` SVG to be the pixel-W; rewrite `AppleGlyph` if not already correct)

Drop:

- `apps/website/src/components/Icons.tsx` — the new design has no per-feature icons
- The Inter web font link in `index.html` — system font only

Add:

- `public/screenshots/` directory (empty, ready for the three screenshots)
- A small `<picture>` or `<img>` placeholder element per screenshot slot

### Files Expected To Change

- `apps/website/index.html` (remove Inter link, update title if needed)
- `apps/website/src/App.tsx` (full rewrite)
- `apps/website/src/styles.css` (full rewrite)
- `apps/website/src/components/Mark.tsx` (rewrite WriterMark SVG to pixel-W)
- `apps/website/src/components/Icons.tsx` (delete)
- `apps/website/public/screenshots/` (new dir)
- `TODOS.md` (update the in-progress entry to reference this spec)

## Responsive Behavior

The Figma frame is desktop-only (1512×993). Define the responsive collapse for narrower viewports:

| Breakpoint | Behavior                                                                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ≥ 1280px   | Full reference layout. Scale gutters proportionally if the viewport is wider than 1512 (cap content area at 1512 centered).                                         |
| 900–1279px | Screenshot column shrinks proportionally (maintain 16:11 aspect on each panel). Left column unchanged.                                                              |
| 600–899px  | Screenshot column drops below the left column. Stack: header → hero → CTA cluster → features → screenshots (vertical stack at full width). Page becomes scrollable. |
| < 600px    | Same as above, but headline scales down to 32px / -1.5% tracking; nav pills wrap or hide "Updates"; download button stays full width.                               |

Hard rule: **on the 1512px reference viewport, the page must not scroll.** Below 1280px, scroll is allowed.

## Open Questions

1. **Hover states for the nav pills** — Updates has no rest visible boundary. Suggest: on hover, both pills get a `1px solid rgba(255,255,255,0.18)` border. Confirm.
2. **Download button hover** — suggest `--surface` lightening to `#3F3F3F`. Confirm.
3. **Where do the three screenshots come from?** Need actual PNGs (or a process to generate them) before launch.
4. **What does "Updates" link to?** A changelog page? The GitHub releases page? The same as the existing `__WRITER_RELEASES_URL__`?
5. **Logo treatment at small sizes** — should the orange rule scale with the mark, or stay 2px regardless? Suggest: stay 2px, scale only the mark.
6. **Pixel-W trademark / brand** — the Figma mark is custom. Confirm it's the intended permanent brand mark before baking it into the SVG.

## Acceptance Criteria

- At a 1512×993 viewport, the rendered page is **pixel-equivalent** to the Figma frame for: logo position, nav pill geometry, headline size + tracking + wrap, download cluster geometry, caption position, features list rhythm, screenshot column dimensions and crop.
- All colors match the tokens above (verifiable via DevTools).
- All typography uses SF Pro Display via system-ui — no web font request fires on page load.
- The orange accent appears only in the logo lockup and nowhere else.
- The download button URL points at the current `Writer_<version>_aarch64.dmg` derived from `tauri.conf.json`.
- Below 900px the page stacks vertically and scrolls.
- `vp build` succeeds with the website bundle staying under 200 KB JS / 10 KB CSS gzipped.
- `vp lint` and `tsc -b` pass.
