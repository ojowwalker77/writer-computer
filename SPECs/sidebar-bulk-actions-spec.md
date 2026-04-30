# Sidebar Bulk Actions Spec

## Summary

Add multi-selection and bulk actions to the sidebar file tree so the user can move, delete, or copy several files in one operation.

This complements `SPECs/sidebar-file-context-menu-spec.md`, which intentionally deferred multi-select to a later spec.

## Goals

- Let the user select multiple files (and optionally directories) in the sidebar.
- Provide bulk delete, bulk move/drag, and bulk copy-paths actions.
- Keep editor state (tabs, history, dirty buffers) consistent after any bulk operation.
- Match common desktop file-tree multi-select conventions.

## Non-Goals

- Bulk rename in v1.
- Tree-wide search-and-replace.
- A separate "selection mode"; selection should be implicit through modifier keys.

## UX Decisions

### Selection model

- Click: select single row.
- `Cmd+Click` (`Ctrl+Click` on Win/Linux): toggle row in selection.
- `Shift+Click`: range-select between the last anchor and the clicked row.
- `Esc` clears the selection.
- Selection is local to the sidebar; it does not change the active editor tab.

### Visual treatment

- Selected rows use the existing active-row treatment but distinguishable from the active-file row.
- The active-file row remains visually marked even when other rows are co-selected.

### Bulk actions

When 2+ rows are selected, the file context menu (or a dedicated action bar) exposes:

- `Delete N items`
- `Copy N relative paths`
- `Copy N absolute paths`
- `Move to...` (folder picker)

Drag-and-drop a multi-selection onto a folder moves all selected entries into that folder.

## Failure And Confirmation

- Bulk delete always shows a single confirmation listing the count and (truncated) names.
- If any item in a bulk operation fails, surface the per-item errors and leave already-completed work in place — do not roll back partial moves.

## Editor State Sync

- Bulk delete must close every affected open tab and prune their histories (reuse the `removePathReferences` action from the context menu spec).
- Bulk move must rewrite open tab paths and per-tab history (reuse `renameOpenFile`).
- Both must cancel pending saves for affected paths.

## Files Expected To Change

- `apps/desktop/src/components/sidebar/file-tree.tsx`
- `apps/desktop/src/components/sidebar/file-tree-node.tsx`
- `apps/desktop/src/hooks/use-sidebar-selection.ts` (new)
- `apps/desktop/src/stores/editor-store.ts`
- `apps/desktop/src/lib/tauri.ts`
- `apps/desktop/src-tauri/src/commands/fs.rs`
- frontend tests under `apps/desktop/tests/`

## Acceptance Criteria

- The user can multi-select files via Cmd/Shift click in the sidebar.
- A bulk delete from the context menu deletes every selected file and cleans up tabs/history accordingly.
- A bulk move via drag-and-drop relocates every selected file to the target folder.
- Single-row interactions remain unchanged for users who never multi-select.
