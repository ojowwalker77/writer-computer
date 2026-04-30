# Keyboard And Accessibility Spec

## Summary

Audit Writer for keyboard usability and accessibility gaps and close the highest-value ones. Today the app leans on mouse/click affordances; many interactive surfaces are not reachable, focusable, or labeled for assistive tools.

## Goals

- Make every interactive surface reachable by keyboard alone.
- Provide a logical, predictable focus order.
- Add visible focus indicators that are not removed by global resets.
- Add accessible names and roles to icon-only controls.
- Document the canonical keyboard shortcut map in one place.

## Non-Goals

- Full WCAG AA certification in v1.
- Localization or RTL layout work.
- Screen-reader-perfect editor narration (the underlying ProseMirror surface needs its own dedicated spec for that).

## Audit Areas

### Sidebar

- File tree must be navigable with arrow keys (Up/Down through visible rows, Right to expand, Left to collapse).
- `Enter` opens the focused row in the active tab; `Cmd+Enter` opens it in a new tab.
- Renaming inline must trap focus in the input until commit/cancel.

### Tab strip

- `Cmd+1..9` activates the Nth tab.
- `Ctrl+Tab` / `Ctrl+Shift+Tab` cycles tabs.
- `Cmd+W` closes the active tab.
- The `+` new tab button must be focusable and labeled.

### Editor

- Focus indicator on the editor surface itself when focused.
- Tab cycles through interactive non-text affordances (links, embeds), not just the document body.

### Command palette and menus

- `Esc` always dismisses.
- Focus returns to the previously focused element on dismiss.
- Arrow keys move selection without losing palette focus.

### Visible focus

- A consistent `:focus-visible` outline applied app-wide.
- Audit for any `outline: none` rules and remove or replace them.

## Implementation Notes

- Add `aria-label` to every icon-only button (sidebar toggles, close, new tab, back/forward, etc.).
- Add `role="tree"` and `role="treeitem"` semantics to the file tree, with `aria-expanded` on directories.
- Build a single `useKeyboardShortcuts` hook that owns the canonical shortcut map and document its bindings in `docs/keyboard-shortcuts.md`.

## Files Expected To Change

- `apps/desktop/src/components/sidebar/`
- `apps/desktop/src/components/editor-area/`
- `apps/desktop/src/components/command-palette/`
- `apps/desktop/src/hooks/use-keyboard-shortcuts.ts`
- global stylesheet for focus styles
- frontend tests under `apps/desktop/tests/`

## Acceptance Criteria

- A keyboard-only user can open files, switch tabs, navigate the sidebar, and dismiss menus without a pointer.
- Every icon-only button has an accessible name.
- A visible focus indicator is present on every focusable element.
- Tab order in major surfaces (sidebar, tab strip, editor) is logical and documented.
