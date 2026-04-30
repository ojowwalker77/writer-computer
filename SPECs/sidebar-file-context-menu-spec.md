# Sidebar file context managemnt

## Summary

Add a right-click context menu for **markdown** files in the sidebar that feels like a desktop file manager menu.

The menu should group open actions at the top, file actions in the middle, and destructive actions at the bottom. It should support the most useful actions from the reference menu without forcing a broader multi-window, bookmarks, or version-history project.

## Scope

This spec is intentionally limited to markdown file rows in the sidebar tree.

- File rows get a native context menu.
- Directory rows keep their current click-to-expand behavior and do not get a context menu in v1.
- The menu is inspired by the reference screenshot, but it is not a requirement to match that menu one-for-one.

This spec complements the already-shipped file-open tab reuse and new-tab launcher behaviors. Where tab-opening behavior overlaps, the context menu should call shared helpers rather than introducing a third set of rules.

## Current Behavior

- `apps/desktop/src/components/sidebar/file-tree-node.tsx` only handles primary click.
- File rows call `useOpenFile()` directly. There is no secondary-click affordance.
- The sidebar has no local selection or rename state beyond the active-file styling.
- `apps/desktop/src/lib/tauri.ts` already exposes `renameEntry(oldPath, newPath)`, `deleteEntry(path)`, `readFile(path)`, `writeFile(path, content)`, and `fileExists(path)`.
- The app already ships with `@tauri-apps/plugin-clipboard-manager`, but the sidebar does not use it yet.
- The app is still effectively single-window. There is no frontend or Rust abstraction for opening another Writer window.

## Goals

- Add a file-row context menu that feels native to desktop usage.
- Support the highest-value file actions directly from the sidebar.
- Keep menu behavior explicit and predictable when tabs are involved.
- Reuse existing editor-store and filesystem flows where possible.
- Fail clearly when a filesystem action cannot be completed.
- Keep the first pass small enough to implement without introducing a new menu library.

## Non-Goals

- Adding a native context menu for directories in v1.
- Adding bookmarks, version history, merge tools, or other document-management systems.
- Adding multi-select or bulk actions.
- Adding multi-window support.
- Replacing the current document-title rename flow.
- Reworking the broader sidebar single-click behavior outside the shared open helper.

## Menu Items

### Included in v1

- `Open`
- `Open in new tab`
- `Duplicate`
- `Copy relative path`
- `Copy absolute path`
- `Reveal in Finder` / `Reveal in Explorer` / `Show in Folder`
- `Delete`

`Rename...` was removed from the file context menu after v1; sidebar rename now lives only on folder rows. The inline-rename UI is still used for naming newly created files.

## UX Decisions

### Triggering the menu

- Secondary click on a markdown file row opens the menu.
- On macOS, Ctrl-click should work through the normal `contextmenu` event path.
- Opening the menu must not also trigger the row's normal open behavior.
- Menu dismissal is handled by the native menu implementation rather than by custom DOM listeners.

### Menu positioning and rendering

- Use Tauri's native menu APIs from `@tauri-apps/api/menu`, not a custom React context-menu overlay.
- Build and show the menu from the file row's `contextmenu` handler.
- Let the operating system handle positioning, keyboard navigation, dismissal, and styling.
- Keep separators and grouping similar to the reference screenshot.
- The app is still responsible for wiring menu item IDs to Writer actions and for supplying the platform-specific reveal label.

### Menu item order

1. `Open`
2. `Open in new tab`
3. separator
4. `Duplicate`
5. separator
6. `Copy relative path`
7. `Copy absolute path`
8. separator
9. `Reveal in Finder` / `Reveal in Explorer` / `Show in Folder`
10. separator
11. `Delete`

`Copy path` is intentionally flattened into two items instead of a nested submenu. That keeps the first implementation smaller and avoids hover-submenu timing bugs.

## Action Semantics

### Open

- `Open` should call the same shared helper that normal sidebar primary-click open uses.
- This keeps the menu aligned with the app's default file-open behavior even if that behavior changes later.
- The shared helper already honors the tab-reuse rules, so the menu inherits that automatically.

### Open in new tab

- `Open in new tab` always creates a distinct new tab session.
- It must not activate an existing matching tab.
- It should activate the newly created tab immediately.
- If the file load fails, the temporary tab must be removed again.

### Duplicate

- `Duplicate` creates a sibling markdown file with a unique name.
- Name pattern examples: `note.md` -> `note copy.md`, then `note copy 2.md`, then `note copy 3.md`, and so on.
- If the source file is open and dirty, the duplicate should use the latest in-memory editor state, not stale disk content.
- If the source file is not open or is clean, duplicating from disk content is fine.
- After duplication succeeds, open the duplicate in a new tab and activate it.

### Copy relative path

- Copy the workspace-relative path using forward slashes.
- Example: `notes/daily/2026-04-03.md`

### Copy absolute path

- Copy the full path as stored by the app.
- This is primarily for interoperability with external tools.

### Reveal in Finder / Explorer / Show in Folder

- The label should be platform-specific:
  - macOS: `Reveal in Finder`
  - Windows: `Reveal in Explorer`
  - Linux: `Show in Folder`
- The action should reveal the file in the OS file manager when the platform supports it.
- On Linux, opening the parent directory without selecting the exact file is acceptable.

### Rename...

- `Rename...` should put the targeted sidebar row into inline rename mode.
- Preserve the `.md` extension automatically; the editable field should show only the stem.
- Empty names are invalid.
- Colliding target names are invalid.
- On success:
  - rename the file on disk
  - update open tab and history references via the existing `renameOpenFile(oldPath, newPath)` path
  - refresh the parent directory in the sidebar
- On failure, exit rename mode and surface the error.

### Delete

- `Delete` moves the file to the system trash using the existing Tauri command.
- If the file is open and dirty, show a confirmation first because this discards unsaved in-memory edits for that path.
- On success:
  - close every open tab whose current file is the deleted path
  - remove the deleted path from other tabs' back and forward history
  - remove the deleted file from `openFiles`
  - cancel any pending save for that path
  - refresh the parent directory in the sidebar
- Deletion should not rely only on the file watcher to clean up editor state.

## Failure And Confirmation Behavior

- Use a native blocking confirm for dirty-file deletion in v1.
- Use a simple blocking alert or equivalent user-visible error dialog for rename, delete, duplicate, or reveal failures.
- Once an item is chosen, let the native menu dismiss before the action continues.
- Failed actions must leave editor and sidebar state unchanged except for transient UI state such as closing the menu.

## Store And API Changes

### Editor store

Add two explicit editor-store actions:

```ts
openFileInNewTab(path: string): Promise<void>
removePathReferences(path: string): void
```

Behavior:

- `openFileInNewTab(...)`
  - always creates a fresh tab id
  - activates the new tab immediately
  - removes the tab again if file loading fails
- `removePathReferences(path)`
  - closes all tabs whose `currentPath` matches `path`
  - removes `path` from the `backHistory` and `forwardHistory` arrays of remaining tabs
  - prunes `openFiles[path]`
  - cancels pending saves for `path`

This avoids overloading the existing path-based helpers that already become ambiguous once duplicate file tabs are allowed.

### Frontend wrappers and helpers

Add or extend wrappers in `apps/desktop/src/lib/tauri.ts` and nearby helpers for:

- a small native-menu helper built on `@tauri-apps/api/menu` for sidebar file actions
- `revealInFileManager(path: string)`
- clipboard write helpers for path copy actions
- a small duplicate helper that:
  - resolves the next available sibling path
  - uses current in-memory content when the source file is dirty
  - otherwise duplicates from disk content

The duplicate helper should reuse existing `readFile`, `writeFile`, `fileExists`, and `serializeFile(...)` utilities rather than introducing a new copy command just for v1.

### Sidebar-local UI state

Keep rename state local to sidebar components instead of pushing it into Zustand unless implementation pressure clearly requires it.

Likely local state needs:

- current inline-rename target path
- temporary rename input value

The native context menu itself does not require local React state for pointer coordinates or outside-click dismissal.

## Backend Changes

Add one new Tauri command:

```rust
reveal_in_file_manager(path: String) -> Result<(), AppError>
```

Platform behavior:

- macOS: use `open -R <path>`
- Windows: use `explorer /select,<path>`
- Linux: open the parent directory

No other new Rust filesystem command is required for this v1 spec.

## Implementation Notes

- `FileTreeNode` should register `onContextMenu` only for markdown files.
- Prevent the browser's default context menu.
- Keep the current left-click behavior unchanged.
- Use a small native-menu helper built on `@tauri-apps/api/menu` rather than a rendered DOM menu.
- Use a shared sidebar file-open helper so `Open` and primary click stay aligned.
- Refresh the parent directory explicitly after rename, delete, and duplicate instead of depending only on watcher timing.
- Reuse `renameOpenFile(...)` for rename propagation rather than inventing a second rename-sync path.
- Do not route delete through the current `closeFile(path)` helper because that only targets one tab and does not clean history references.

## Files Expected To Change

- `apps/desktop/src/components/sidebar/file-tree.tsx`
- `apps/desktop/src/components/sidebar/file-tree-node.tsx`
- a small native-menu helper for sidebar file actions under `apps/desktop/src/components/sidebar/` or `apps/desktop/src/lib/`
- `apps/desktop/src/hooks/use-tabs.ts`
- `apps/desktop/src/hooks/editor-api.ts`
- `apps/desktop/src/lib/tauri.ts`
- `apps/desktop/src/lib/paths.ts`
- `apps/desktop/src/lib/frontmatter.ts` only if a tiny duplicate helper belongs there, otherwise not required
- `apps/desktop/src/stores/editor-store.ts`
- `apps/desktop/src/hooks/use-file-tree.ts` or `apps/desktop/src/stores/workspace-store.ts` if a small parent-refresh helper is added
- `apps/desktop/src-tauri/src/commands/fs.rs`
- `apps/desktop/src-tauri/src/lib.rs`
- frontend tests in `apps/desktop/tests/`
- Rust tests for the new reveal command if practical per platform abstraction

## Test Plan

### Store tests

- `openFileInNewTab(path)` creates a second tab even when the same file is already open.
- failed `openFileInNewTab(...)` removes the temporary tab again.
- `removePathReferences(path)` closes all tabs whose `currentPath` matches `path`.
- `removePathReferences(path)` strips that path from all remaining back and forward histories.
- `renameOpenFile(oldPath, newPath)` still rewrites current, back, and forward references correctly.

### Component tests

- right clicking a file row invokes the native-menu helper for that file.
- opening the menu does not trigger the normal open action.
- `Open in new tab` dispatches the explicit new-tab path rather than the default open helper.
- `Rename...` enters inline rename mode on the targeted row.
- `Copy relative path` and `Copy absolute path` send the expected string to the clipboard helper.
- the reveal action uses the platform-specific label.

### Manual verification

- Right click a sidebar file and verify the menu appears in the expected grouped order.
- Choose `Open` and verify it matches the current default sidebar open behavior.
- Choose `Open in new tab` for a file that is already open and verify a distinct additional tab appears.
- Duplicate a clean file and verify the new sibling file is created and opened.
- Duplicate a dirty open file and verify the duplicate contains the unsaved edits.
- Rename a file from the sidebar and verify the active tab title and history still point to the new path.
- Delete a clean file and verify it disappears from the tree and all matching tabs close.
- Delete a dirty open file and verify the confirmation appears before the delete proceeds.
- Choose `Reveal in Finder` / `Reveal in Explorer` / `Show in Folder` and verify the file manager opens to the expected location.

## Risks And Mitigations

### Main risks

- Duplicate file tabs make some old path-based helpers ambiguous.
- Delete can race with pending saves and leave inconsistent editor state if cleanup is incomplete.
- Reveal behavior is platform-specific and hard to test uniformly.
- Native-menu invocation can still accidentally trigger the row click if event handling is sloppy.

### Mitigations

- Add explicit `openFileInNewTab(...)` and `removePathReferences(path)` actions instead of hiding more behavior inside `openFile(path)` or `closeFile(path)`.
- Cancel pending saves and prune editor state explicitly on delete.
- Keep all reveal logic behind one Tauri command with platform-specific branching isolated in Rust.
- Cover the `contextmenu` interaction path and native-menu invocation with focused component tests.

## Acceptance Criteria

- Secondary clicking a markdown file row in the sidebar opens a native context menu.
- The menu includes `Open`, `Open in new tab`, `Duplicate`, `Copy relative path`, `Copy absolute path`, `Reveal in Finder` / `Reveal in Explorer` / `Show in Folder`, `Rename...`, and `Delete`.
- Choosing `Open` uses the same default open behavior as a normal sidebar file click.
- Choosing `Open in new tab` always creates a distinct new tab session.
- Duplicate creates a uniquely named sibling file and opens it.
- Rename updates open tab and history references correctly.
- Delete removes the file from sidebar and editor state without leaving stale tabs or history entries behind.
- The feature uses Tauri native menu APIs rather than a custom React context-menu implementation.
