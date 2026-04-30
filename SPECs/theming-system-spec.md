# Theming System Spec

## Summary

Replace the hand-tuned static CSS-var palette with a **CSS-var-driven theming system** built on a small set of user-controlled primary tokens per mode (light/dark). Everything else (borders, hover bgs, secondary text, cards, scrollbar thumbs) is **derived** in CSS via `color-mix()` and `calc()` from those primaries. Translucency applies app-wide and is tied to background opacity. Contrast scales the alpha of derived overlay layers.

Supersedes [`body-theming-spec.md`](./body-theming-spec.md), which scoped a smaller editor-body-only theming surface.

## Goals

- Let users customize Accent, Background, Foreground, UI font, Editor font, Translucency, and Contrast per mode (light/dark) — all live, with no restart.
- Ship 4 curated presets (`Codex`, `Default`, `Warm Paper`, `High Contrast`) plus a `Custom` state when the user edits any token.
- Provide Import (paste a JSON blob) and Copy (export current primaries to clipboard) per mode.
- Apply translucency app-wide (every surface), not just the sidebar.
- Keep the system testable: derivations are pure CSS expressions; JS only writes primaries.

## Non-Goals

- Per-document themes.
- Third-party theme marketplace / arbitrary plugin themes (v1).
- Per-workspace theming (kept global for v1; settings store still supports workspace scope if we promote later).

## Token Model

### Primary tokens (user-controlled, per mode)

| Token           | Type                      | Notes                                                                                                                                           |
| --------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `--accent`      | color (hex)               | Links, focus rings, toggles.                                                                                                                    |
| `--bg-base`     | opaque hex                | Underlying background color, kept opaque.                                                                                                       |
| `--fg-base`     | opaque hex                | Foreground/text color, kept opaque.                                                                                                             |
| `--ui-font`     | string                    | UI font stack.                                                                                                                                  |
| `--editor-font` | string                    | Editor body font stack. Also pushed to `--writer-editor-font-family`.                                                                           |
| `--bg-opacity`  | 0..1 (slider 0–100 in UI) | 1 = solid; <1 = translucent. The "Translucency" slider writes directly to this.                                                                 |
| `--contrast`    | 0..2 (slider 0–200 in UI) | Multiplier on derived overlay alphas. Base factors tuned so slider=100 is "comfortable, fully visible" and slider=200 is the practical ceiling. |

Stored in settings as `theme.{mode}.{key}` — see Schema below. JS reads these on every settings change and writes the seven CSS custom properties on `:root`.

### Derived tokens (in CSS, not JS)

All written once in `App.css` using the primaries:

```css
--bg: color-mix(in srgb, var(--bg-base) calc(var(--bg-opacity) * 100%), transparent);
--text-primary: var(--fg-base);
--text-secondary: color-mix(in srgb, var(--fg-base) 80%, transparent);
--text-muted: color-mix(in srgb, var(--fg-base) 54%, transparent);
--text-icon-muted: color-mix(in srgb, var(--fg-base) 40%, transparent);

--border-color: color-mix(in srgb, var(--fg-base) calc(var(--contrast) * 9%), transparent);
--line-subtle: color-mix(in srgb, var(--fg-base) calc(var(--contrast) * 9%), transparent);
--line-subtler: color-mix(in srgb, var(--fg-base) calc(var(--contrast) * 5%), transparent);
--focus-border: color-mix(in srgb, var(--fg-base) calc(var(--contrast) * 25%), transparent);

--surface-card: color-mix(in srgb, var(--fg-base) calc(var(--contrast) * 6%), transparent);
--surface-subtle: color-mix(in srgb, var(--fg-base) calc(var(--contrast) * 7%), transparent);
--surface-subtle-strong: color-mix(
  in srgb,
  var(--fg-base) calc(var(--contrast) * 14%),
  transparent
);
--surface-input: color-mix(in srgb, var(--fg-base) calc(var(--contrast) * 8%), transparent);
--surface-selected: color-mix(in srgb, var(--fg-base) calc(var(--contrast) * 10%), transparent);
--surface-palette: color-mix(
  in srgb,
  var(--bg-base) 80%,
  transparent
); /* command palette stays semi-opaque on its own backdrop blur */

--item-hover-bg: color-mix(in srgb, var(--fg-base) calc(var(--contrast) * 6%), transparent);
--item-active-bg: color-mix(in srgb, var(--fg-base) calc(var(--contrast) * 10%), transparent);
--tab-active-bg: color-mix(in srgb, var(--fg-base) calc(var(--contrast) * 9%), transparent);

--code-bg: color-mix(in srgb, var(--fg-base) calc(var(--contrast) * 6%), transparent);
--kbd-bg: color-mix(in srgb, var(--fg-base) calc(var(--contrast) * 6%), transparent);
--scrollbar-thumb: color-mix(in srgb, var(--fg-base) calc(var(--contrast) * 22%), transparent);
--blockquote-border: color-mix(in srgb, var(--fg-base) calc(var(--contrast) * 22%), transparent);

--link-color: var(--accent);
--editor-bg: var(--bg); /* whole-app translucency: editor inherits */
--sidebar-bg: var(--bg); /* whole-app translucency: sidebar inherits */
--tab-bar-bg: transparent;
--tab-bg: transparent;
```

Notes:

- Every overlay layer is `fg-on-transparent` so OS vibrancy shows through whenever `--bg-opacity < 1`. Stacking translucent overlays over a translucent root is what creates the "frosted" hierarchy.
- `--surface-primary` (today opaque `#111`/`#FFF`) is replaced with `var(--bg-base)` for any context that needs an opaque fill (e.g., welcome screen button text-on-bg). All other "surface" usages move to derived overlay tokens.
- Sidebar dividers (`--sidebar-divider-left/right`) collapse into `--line-subtle` — the asymmetric dark/light pair was a hand-tuned trick that the contrast-driven model handles uniformly.

### Why this works for the user's three constraints

1. **Translucency app-wide** — `--bg` is the only opaque painter; everything else is fg-over-transparent. Lower `--bg-opacity` → vibrancy bleeds through every surface.
2. **Translucency tied to background opacity** — they are literally the same number (`--bg-opacity`).
3. **Contrast scales derived alphas** — every overlay multiplies its base alpha by `var(--contrast)`. Slider at 0 → flat (no visible borders/cards/hovers); slider at 100 → maximum legibility.

## UX

### Where it lives

A new **Themes** section in the existing Preferences panel (`apps/desktop/src/components/settings-panel/`), rendered above existing categories. Layout matches the user's mock:

- Two stacked cards: "Light theme" and "Dark theme".
- Each card header: section title (left) + `Import` link + `Copy theme` link + preset dropdown (right).
- Each card body: rows for Accent (color), Background (color), Foreground (color), UI font (string), Editor font (string), Translucency (slider 0–100), Contrast (slider 0–200).

Live preview as the user edits.

### Preset behavior

- Selecting a preset writes all seven primaries for that mode at once.
- Editing any token after preset selection switches the dropdown label to **Custom** without erasing the user's edits. The preset key (`theme.{mode}.preset`) is set to `"custom"`.
- A preset definition lives in `apps/desktop/src/lib/theme-presets.ts` as a typed record `{ light: PrimarySet, dark: PrimarySet }`.

### Import / Copy

- **Copy theme**: serializes the current primaries for that mode as a single-line JSON object and writes to clipboard.
- **Import**: prompts (modal or inline textarea) for a JSON blob, validates schema, applies all primaries atomically. Invalid input → inline error, no partial application.

## Settings Schema

New keys (all in `apps/desktop/src-tauri/src/config.rs`):

```
theme.light.preset       enum  [Codex, Default, Warm Paper, High Contrast, custom]   default: Codex
theme.light.accent       color                                                       default: "#0169CC"
theme.light.background   color                                                       default: "#FFFFFF"
theme.light.foreground   color                                                       default: "#0D0D0D"
theme.light.ui-font      string                                                      default: system stack
theme.light.editor-font  string                                                      default: SF Pro Text stack
theme.light.translucent  range [0, 100, step 1]                                      default: 0    (solid)
theme.light.contrast     range [0, 200, step 1]                                      default: 40

theme.dark.preset       enum  [Codex, Default, Warm Paper, High Contrast, custom]    default: Codex
theme.dark.accent       color                                                        default: "#0169CC"
theme.dark.background   color                                                        default: "#111111"
theme.dark.foreground   color                                                        default: "#FCFCFC"
theme.dark.ui-font      string                                                       default: system stack
theme.dark.editor-font   string                                                       default: SF Pro Text stack
theme.dark.translucent  range [0, 100, step 1]                                       default: 30
theme.dark.contrast     range [0, 200, step 1]                                       default: 50
```

Two new `value_type` strings on `SettingDef`:

- `"color"` — frontend renders a color picker + hex input.
- `"range"` — frontend renders a slider + numeric label; bounds and step come from `options` as `["min", "max", "step"]` (string-encoded numbers since the existing `options` field is `Option<Vec<String>>`).

`appearance.theme` (system/light/dark) is unchanged — it picks **which** of the two token sets is active.

## Architecture

### Apply pipeline

```
settings-store mutation
  → applySettingsSideEffects(settings)
    → applyTheme(appearance.theme)             // sets data-theme attribute (existing)
    → applyThemeTokens(mode, primaries)        // NEW: writes 7 CSS vars on :root
```

`applyThemeTokens` lives in `apps/desktop/src/lib/theme.ts`. It writes:

```
:root {
  --accent: <hex>;
  --bg-base: <hex>;
  --fg-base: <hex>;
  --ui-font: <stack>;
  --editor-font: <stack>;
  --bg-opacity: <0..1>;
  --contrast: <0..1>;
}
```

The CSS file's derivation block does the rest. `data-theme="light"` vs `data-theme="dark"` no longer toggles different CSS — it's purely an attribute hook, and the chosen mode's primaries are pushed by JS.

### Listening to system changes

`applyTheme` already wires a `prefers-color-scheme` listener for `system` mode; it now also calls `applyThemeTokens` with the corresponding mode's primaries when the system flips.

### Translucency interaction with macOS vibrancy

Tauri's macOS window already has vibrancy enabled (`html, body, #root` are `background: transparent`, root paints `--bg`). Lowering `--bg-opacity` to 0 won't crash but produces a fully transparent window — clamp UI to 0–95 (i.e. min 5% opacity) to avoid "I lost my window" surprises. Decision: clamp at the React layer, not in CSS, so the underlying number stays clean.

## Files Changed

**Frontend**

- `apps/desktop/src/App.css` — replace static `:root` / `[data-theme="light"]` color blocks with derivation rules. Keep non-color rules (focus, scrollbar, cmdk dialog structure).
- `apps/desktop/src/lib/theme.ts` — add `applyThemeTokens(mode, primaries)`; modify `applyTheme` to also push primaries.
- `apps/desktop/src/lib/theme-presets.ts` — new. Preset definitions, `parseThemeImport`, `exportTheme`.
- `apps/desktop/src/stores/settings-store.ts` — extend `applySettingsSideEffects` to call `applyThemeTokens`. Helper to resolve effective mode from `appearance.theme` + system pref.
- `apps/desktop/src/components/settings-panel/setting-control.tsx` — add `ColorControl` and `RangeControl`.
- `apps/desktop/src/components/settings-panel/themes-section.tsx` — new. Two-card layout matching the mock.
- `apps/desktop/src/components/settings-panel/index.tsx` — render `<ThemesSection/>` above the existing schema-driven categories. Hide `theme.*` keys from the generic schema renderer (they're owned by the new section).

**Backend**

- `apps/desktop/src-tauri/src/config.rs` — add the 16 new `SettingDef`s, defaults, and the two new `value_type`s. Add a `ConfigValue` round-trip test for color strings (currently parsed as `String` — works, but worth a test).

**Docs**

- `SPECs/theming-system-spec.md` — this file.
- `SPECs/body-theming-spec.md` — superseded; add a header note pointing here.
- `TODOS.md` — move into In Progress.
- `CHANGELOG.md` — entry on completion.

## Acceptance Criteria

- The Preferences panel shows a Themes section with Light and Dark cards matching the mock.
- Editing any of the seven primaries updates the UI live with no restart.
- Selecting a preset writes all primaries for that mode at once. Editing any token after switches the preset selector to "Custom" without erasing edits.
- Translucency slider in dark mode at 30 produces visible OS vibrancy through every surface (sidebar, editor, tab bar, palette, settings panel).
- Contrast slider at 0 → borders/cards/hovers vanish; at 100 → they hit max alpha. Linear in between.
- Copy theme writes a JSON blob; pasting that blob into Import on a fresh install reproduces the exact look.
- `appearance.theme = system` follows the OS dark/light flip and re-applies the corresponding token set.
- The seven primaries persist across app restarts in the existing `config` file.
- No regression in existing components — every surface that previously used a CSS var still resolves.

## Tradeoffs

- **Derivation in CSS vs JS**: CSS keeps the apply path cheap (one batch write of 7 props) and lets devtools show the resolved colors. The cost is needing `color-mix()` (Safari 15.4+ — fine for Tauri WKWebView).
- **Contrast as alpha multiplier vs perceptual contrast**: a perceptual contrast model (WCAG-aware, picking different fg blends per surface) would be more "correct" but invisible to the user. Linear alpha is what the mock implies and is debuggable.
- **Translucency clamp**: capping at 5% min opacity protects users from invisible windows. Power users who want true 0% can edit the config file directly.
- **`appearance.theme` vs `theme.*`**: keeping them separate (mode picker vs per-mode tokens) preserves the existing system/light/dark UX and lets users tune both modes independently — matches the mock exactly.

## Migration

- Existing users have no `theme.*` keys → backend defaults apply → app looks ~identical to today (Codex preset is close to current dark, Default is close to current light).
- The previous fixed CSS color literals in `:root` and `[data-theme="light"]` are removed; their consumers all reference CSS vars already, so no component-level changes are needed beyond the App.css edit.
- One-time migration: none required. The settings file gains new keys lazily as the user edits them.

## Risks

- **`color-mix()` corner cases**: blending across very different hues can produce muddy mids. The base palette uses neutral fg/bg, so the risk is small. Mitigation: ship presets that have been visually verified.
- **Settings spam on slider drag**: each slider tick writes to disk via `set_setting`. Mitigation: debounce slider writes at the React layer (commit on `pointerup`, preview during drag by setting CSS vars directly without persisting).
- **Existing `--surface-primary` consumers**: a global grep before the refactor confirms which usages need to flip to `--bg-base` vs an overlay token. Listed as a checklist in the implementation PR.
