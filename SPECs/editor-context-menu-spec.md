# Editor Context Menu Spec

## Summary

Add a native right-click context menu to the editor surface (and other key surfaces lacking one), beyond the sidebar file rows already covered by `SPECs/sidebar-file-context-menu-spec.md`.

## Scope

Surfaces that need a v1 context menu:

- Editor body (markdown content area)
- Editor tab (right-click on a tab)
- Document title bar

## Goals

- Provide a native, OS-styled context menu via `@tauri-apps/api/menu` for each target surface.
- Surface the most common per-surface actions without inventing a custom DOM menu.
- Stay consistent with the sidebar context menu's grouping and styling conventions.

## Non-Goals

- A theming or customization system for context menus.
- Per-selection rich actions (e.g., "Search Google for selection") in v1.
- Replacing system text-input context menus inside `<input>` elements.

## Menu Contents

### Editor body

1. `Cut`
2. `Copy`
3. `Paste`
4. `Paste as plain text`
5. separator
6. `Select all`
7. separator
8. `Open link` (only when right-clicking on a link)
9. `Copy link` (only when right-clicking on a link)

### Editor tab

1. `Close`
2. `Close others`
3. `Close all`
4. separator
5. `Reveal in sidebar`
6. `Copy path`

### Document title

1. `Rename`
2. `Reveal in Finder` / `Reveal in Explorer` / `Show in Folder`
3. `Copy path`

## Implementation Notes

- Use `@tauri-apps/api/menu` for all three menus (mirror the sidebar context menu helper).
- Each surface registers a `contextmenu` handler that builds and shows the menu.
- Reuse `revealInFileManager`, clipboard helpers, and `removePathReferences` from the sidebar context menu spec.
- Cut/copy/paste should use the editor's existing keymap commands so undo behavior matches.
- Disable irrelevant items (e.g., `Paste` when the clipboard is empty) instead of hiding them.

## Files Expected To Change

- `apps/desktop/src/components/editor-area/index.tsx`
- `apps/desktop/src/components/editor-area/editor-tabs.tsx`
- `apps/desktop/src/components/document-title/`
- a shared `apps/desktop/src/lib/native-menu.ts` if one is not already extracted by the sidebar spec
- frontend tests under `apps/desktop/tests/`

## Acceptance Criteria

- Right-clicking the editor body opens a native context menu with cut/copy/paste/select-all and link actions when applicable.
- Right-clicking a tab opens close-related actions plus reveal-in-sidebar.
- Right-clicking the document title opens rename, reveal, and copy-path actions.
- All menus use Tauri's native menu APIs, not a custom DOM overlay.
