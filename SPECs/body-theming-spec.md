# Body Theming Spec

> **Superseded by [`theming-system-spec.md`](./theming-system-spec.md)** — the full theming system covers everything proposed here (per-mode token primaries, fonts, presets, import/copy) at app scope rather than just the editor body.

## Summary

Let the user customize the editor body's typographic and color presentation through a small set of presets and a few user-controlled tokens. Today, the editor body uses one fixed look.

## Goals

- Provide 3-5 curated presets (e.g., `Default`, `Serif`, `Mono`, `Warm Paper`, `High Contrast`).
- Expose a small panel for adjusting font family, font size, line height, content width, and accent.
- Persist the user's choice per workspace (or globally — see Tradeoff).
- Apply themes only to the editor body, not the chrome.

## Non-Goals

- Full theming API or third-party themes in v1.
- Per-document themes.
- Theming the sidebar, tabs, command palette, or window chrome.

## UX Decisions

### Where to expose it

- Add an `Appearance` section to a forthcoming Settings surface, or for v1, expose it in a dropdown reachable from the document title bar.
- Live preview as the user changes values.

### Tokens

- `--writer-body-font-family`
- `--writer-body-font-size`
- `--writer-body-line-height`
- `--writer-body-content-width`
- `--writer-body-accent`

These tokens scope under a `.writer-body` class on the editor surface so the chrome remains unaffected.

### Presets

Each preset sets the tokens above to a curated bundle. Custom values override the preset.

## Persistence

- Store theming choice in `localStorage` for v1 simplicity.
- Migrate to per-workspace storage if the feature graduates.

## Tradeoff

Per-workspace vs. global: per-workspace is more flexible but doubles the persistence surface. Start global; revisit if users ask for per-workspace.

## Files Expected To Change

- `apps/desktop/src/components/editor-area/` (apply tokens to body wrapper)
- `apps/desktop/src/components/appearance-panel.tsx` (new)
- `apps/desktop/src/stores/ui-store.ts` (or a new `appearance-store`)
- global stylesheet for token defaults

## Acceptance Criteria

- The user can pick from a set of presets and the editor body updates immediately.
- The user can adjust font, size, line-height, width, and accent independently.
- The chrome (sidebar, tabs, palette) is unaffected by body theming.
- The chosen theme persists across app restarts.
