# Breadcrumb Spec

Show a breadcrumb above the editor that displays the active document's location in the workspace tree (e.g., `notes / planning / Roadmap`). Each segment is clickable and reveals/expands that level.

## Goals

- Display the workspace-relative path as a clickable breadcrumb.
- Clicking a segment scrolls the sidebar to and expands that folder.
- Last segment shows the document title.
- Stay compact and avoid wrapping awkwardly when paths are deep.

## Non-Goals

- Inline rename from the breadcrumb in v1.
- Drag-and-drop on segments in v1.
- Showing breadcrumbs for the launcher tab.

## UX Decisions

### Layout

- Render the breadcrumb above the editor body, below the tab strip.
- Segments separated by a thin chevron or slash glyph.
- Long paths collapse middle segments into an ellipsis with a hover tooltip showing the full path.
- The last segment matches the document title (and updates on rename).

### Interaction

- Clicking a directory segment scrolls the sidebar to that directory and expands it without changing the active tab.
- Right-clicking a segment opens a small menu with `Reveal in sidebar`, `Copy path`.
- Clicking the document segment focuses the editor.

## Implementation Notes

- Derive the breadcrumb from the active tab's `currentPath` and the workspace root.
- Add a `useFocusSidebarPath(path)` hook that the breadcrumb calls on segment click.
- Truncation logic should be based on container width, not segment count.

## Files Expected To Change

- `apps/desktop/src/components/editor-area/breadcrumb.tsx` (new)
- `apps/desktop/src/components/editor-area/index.tsx`
- `apps/desktop/src/hooks/use-focus-sidebar-path.ts` (new)
- frontend tests

## Acceptance Criteria

- The breadcrumb appears above the editor for any file-backed tab.
- Clicking a directory segment scrolls and expands the sidebar to that folder.
- Long paths truncate via an ellipsis without overflowing.
- The breadcrumb is hidden for launcher tabs.
