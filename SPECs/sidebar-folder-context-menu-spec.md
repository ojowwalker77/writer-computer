# Sidebar folder context menu

## Summary

Add a right-click context menu for **directory** rows in the sidebar, complementing the existing file context menu shipped in Phase 2.

The menu groups creation actions at the top, path utilities in the middle, and file-management actions at the bottom. It reuses the existing native-menu helper pattern, Tauri IPC commands, and store actions where possible.

## Scope

- Directory rows get a native context menu.
- File rows keep their existing context menu unchanged.
- The menu uses the same Tauri native menu infrastructure as the file context menu.

## Current Behavior

- `file-tree-node.tsx` early-returns from `handleContextMenu` when `entry.is_dir` is true — folders have no secondary-click affordance.
- `file-context-menu.ts` defines `showFileContextMenu` using `@tauri-apps/api/menu`. The pattern is reusable for a parallel folder menu.
- Rust commands `create_directory`, `rename_entry`, `delete_entry`, and `reveal_in_file_manager` already work for directories.
- `tauri.ts` wraps `createDirectory`, `renameEntry`, `deleteEntry`, `revealInFileManager`, and `fileExists`.
- The workspace store exposes `refreshDirectory` and `invalidatePath` for cache updates.
- Rename mode in `FileTreeNode` is currently skipped for directories (`if (isRenaming && !entry.is_dir)`).

## Goals

- Add a folder-row context menu that feels native and consistent with the file context menu.
- Support creating files and folders from the sidebar without touching the OS file manager.
- Support rename, delete, reveal, and path-copy actions for folders.
- Handle open-file cleanup correctly when a folder is renamed or deleted.

## Non-Goals

- Drag-and-drop reordering or moving items between folders.
- Folder duplication (complex recursive copy, low value for v1).
- Folder-level bookmarks, tags, or metadata.
- Nested "New File" with template selection.

## Menu Items

### Included in v1

- `New File`
- `New Folder`
- `Copy relative path`
- `Copy absolute path`
- `Reveal in Finder` / `Reveal in Explorer` / `Show in Folder`
- `Rename...`
- `Delete`

### Menu item order

1. `New File`
2. `New Folder`
3. separator
4. `Copy relative path`
5. `Copy absolute path`
6. separator
7. `Reveal in Finder` / `Reveal in Explorer` / `Show in Folder`
8. separator
9. `Rename...`
10. `Delete`

## UX Decisions

### Triggering the menu

- Secondary click on a directory row opens the menu.
- On macOS, Ctrl-click works through the normal `contextmenu` event path.
- Opening the menu must not also trigger the row's toggle-expand behavior.
- Menu dismissal is handled by the native menu implementation.

### Menu positioning and rendering

- Use the same Tauri native menu approach as `file-context-menu.ts`.
- Create a parallel `folder-context-menu.ts` module with the same shape (`buildFolderMenuItemsSpec` + `showFolderContextMenu`).
- Reuse `detectPlatform` and `revealLabelForPlatform` from `file-context-menu.ts`.

## Action Semantics

### New File

- Create a new untitled markdown file inside the target folder.
- Name pattern: `Untitled.md`, then `Untitled 2.md`, `Untitled 3.md`, etc.
- Resolve the next available name by checking `fileExists` in a loop.
- Write an empty file to disk.
- Expand the folder if it is currently collapsed so the new file is visible.
- Refresh the folder's directory cache.
- Enter inline rename mode on the newly created file so the user can immediately name it.

### New Folder

- Create a new subfolder inside the target folder.
- Name pattern: `Untitled Folder`, then `Untitled Folder 2`, `Untitled Folder 3`, etc.
- Resolve the next available name by checking `fileExists` in a loop.
- Expand the parent folder if collapsed.
- Refresh the parent folder's directory cache.
- Enter inline rename mode on the newly created folder.

### Copy relative path

- Copy the workspace-relative path using forward slashes.
- Example: `notes/daily`

### Copy absolute path

- Copy the full absolute path as stored by the app.

### Reveal in Finder / Explorer / Show in Folder

- Use the same platform-specific label as the file context menu.
- Call `revealInFileManager(path)` which already supports directories.

### Rename...

- Put the targeted directory row into inline rename mode.
- The editable field shows the full folder name (no extension stripping).
- Empty names are invalid.
- Colliding target names are invalid.
- On success:
  - Rename the directory on disk via `renameEntry`.
  - Update all open tabs whose `currentPath` starts with the old folder path — rewrite the prefix to the new path.
  - Remove the old folder path from back/forward history entries of all tabs and rewrite matching prefixes.
  - Refresh the parent directory in the sidebar.
  - Update `expandedDirs` if the renamed folder was expanded.
- On failure, exit rename mode and surface the error.

### Delete

- Move the folder to the system trash via `deleteEntry`.
- If any files inside the folder are currently open and dirty, show a confirmation listing how many unsaved files will be lost.
- On success:
  - Close all open tabs whose `currentPath` starts with the deleted folder path.
  - Remove all matching paths from other tabs' back and forward histories.
  - Remove matching paths from `openFiles`.
  - Cancel any pending saves for matching paths.
  - Remove the folder from `expandedDirs`.
  - Invalidate the deleted folder's directory cache entry.
  - Refresh the parent directory in the sidebar.
- Deletion should not rely only on the file watcher to clean up editor state.

## Failure And Confirmation Behavior

- Use a native blocking confirm for delete when the folder contains dirty open files.
- Use a simple blocking alert for rename, delete, or creation failures.
- Failed actions must leave editor and sidebar state unchanged.

## Store And API Changes

### Editor store

Add one new action:

```ts
removePathsWithPrefix(prefix: string): void
```

Behavior:

- Close all tabs whose `currentPath` starts with `prefix`.
- Remove matching paths from the `backHistory` and `forwardHistory` arrays of remaining tabs.
- Prune matching entries from `openFiles`.
- Cancel pending saves for matching paths.

This complements the existing `removePathReferences(path)` which handles exact matches.

Add one new action:

```ts
rewritePathPrefix(oldPrefix: string, newPrefix: string): void
```

Behavior:

- For all tabs whose `currentPath` starts with `oldPrefix`, replace the prefix with `newPrefix`.
- Do the same for `backHistory` and `forwardHistory` entries.
- Rekey matching `openFiles` entries.
- Rekey pending save entries.

### Workspace store

Add or extend:

```ts
rewriteExpandedDir(oldPath: string, newPath: string): void
```

Behavior:

- If `expandedDirs` contains `oldPath`, remove it and add `newPath`.
- Also rewrite any expanded child paths that start with `oldPath/`.

### Frontend helpers

Add `folder-context-menu.ts` alongside `file-context-menu.ts`:

```ts
export type FolderMenuActionId =
  | "new-file"
  | "new-folder"
  | "copy-relative-path"
  | "copy-absolute-path"
  | "reveal"
  | "rename"
  | "delete";

export interface FolderContextMenuHandlers {
  onNewFile: () => void;
  onNewFolder: () => void;
  onCopyRelativePath: () => void;
  onCopyAbsolutePath: () => void;
  onReveal: () => void;
  onRename: () => void;
  onDelete: () => void;
}
```

Extract `detectPlatform` and `revealLabelForPlatform` into a shared utility (e.g. `context-menu-utils.ts`) imported by both file and folder menu modules.

Add a small `resolveUniqueName` helper used by both "New File" and "New Folder":

```ts
async function resolveUniqueName(
  parentPath: string,
  baseName: string,
  extension: string,
): Promise<string>;
```

## Sidebar-local UI State

Extend the existing `renamingPath` state in `FileTree` to also support directory rows. The `FileTreeNode` component needs to allow rename mode for directories — remove the `!entry.is_dir` guard.

For "New File" and "New Folder", the flow is:

1. Create the entry on disk with the default name.
2. Refresh the directory cache so the new entry appears.
3. Set `renamingPath` to the new entry's path to enter inline rename mode.

This reuses the existing rename infrastructure without adding new state.

### Rename mode for directories

The rename input for directories should show the full name (not stem + extension). Adjust the rename input logic:

- For files: show the stem, append the extension on submit (existing behavior).
- For directories: show the full name, use it directly on submit.

## Backend Changes

No new Rust commands are required. All needed commands (`create_directory`, `rename_entry`, `delete_entry`, `reveal_in_file_manager`) already exist.

## Implementation Notes

- Lift the `entry.is_dir` guard in `FileTreeNode.handleContextMenu` so directories also trigger `onContextMenu`.
- In `FileTree`, check `entry.is_dir` inside `handleContextMenu` to dispatch to either `showFileContextMenu` or `showFolderContextMenu`.
- Remove the `!entry.is_dir` guard in the rename rendering branch of `FileTreeNode`.
- For folder rename, show the full name instead of stem-only.
- Expand a folder before entering rename mode on a new child, so the renamed entry is visible in the tree.
- Reuse `detectPlatform` and `revealLabelForPlatform` from the extracted shared utility.
- Refresh the directory cache explicitly after all mutations.

## Files Expected To Change

- `apps/desktop/src/components/sidebar/file-tree-node.tsx` — remove `is_dir` guards for context menu and rename mode
- `apps/desktop/src/components/sidebar/file-tree.tsx` — add folder context menu handler, extend rename logic for dirs
- `apps/desktop/src/components/sidebar/folder-context-menu.ts` — new module, parallel to `file-context-menu.ts`
- `apps/desktop/src/components/sidebar/file-context-menu.ts` — extract shared utils
- `apps/desktop/src/components/sidebar/context-menu-utils.ts` — new shared module for `detectPlatform`, `revealLabelForPlatform`
- `apps/desktop/src/hooks/editor-api.ts` — add `removePathsWithPrefix`, `rewritePathPrefix`
- `apps/desktop/src/stores/editor-store.ts` — implement prefix-based path operations
- `apps/desktop/src/stores/workspace-store.ts` — add `rewriteExpandedDir`
- `apps/desktop/src/hooks/use-file-tree.ts` — expose new workspace store action
- Frontend tests for the new menu and store actions

## Test Plan

### Store tests

- `removePathsWithPrefix(prefix)` closes all tabs whose path starts with `prefix`.
- `removePathsWithPrefix(prefix)` strips matching paths from all remaining histories.
- `rewritePathPrefix(old, new)` rewrites `currentPath`, history entries, and `openFiles` keys.
- `rewriteExpandedDir(old, new)` updates `expandedDirs` for the folder and its children.

### Component tests

- Right-clicking a directory row invokes the folder context menu.
- Opening the menu does not trigger folder expand/collapse.
- Right-clicking a file row still invokes the file context menu.
- `New File` creates a file and enters rename mode.
- `New Folder` creates a folder and enters rename mode.
- `Rename...` enters inline rename mode on the directory row.
- `Copy relative path` and `Copy absolute path` send the expected strings to the clipboard.
- The reveal action uses the platform-specific label.
- `Delete` with dirty open files inside shows confirmation.

### Manual verification

- Right-click a folder and verify the menu appears with the correct items.
- Choose `New File` and verify a new file appears inside the folder in rename mode.
- Submit the rename and verify the file is created with the entered name.
- Choose `New Folder` and verify a new subfolder appears in rename mode.
- Rename a folder that contains open files and verify all tab titles update.
- Delete a folder containing open tabs and verify all matching tabs close.
- Delete a folder with dirty files and verify the confirmation appears.
- Choose `Reveal in Finder` on a folder and verify the OS file manager opens.
- Copy a folder's relative path and verify it matches the workspace-relative path.

## Risks And Mitigations

### Main risks

- Prefix-based path rewriting during folder rename could match unrelated paths if a folder name is a prefix of a sibling (e.g. `notes` and `notes-archive`). Must match on `prefix + "/"` or exact match.
- Deleting a folder with many open files requires cleaning up all of them atomically to avoid inconsistent state.
- "New File" / "New Folder" can fail between disk creation and rename mode entry, leaving an awkwardly named file.

### Mitigations

- Use `oldPath + "/"` as the prefix for rewriting to avoid sibling collisions. The folder's own path is an exact match.
- `removePathsWithPrefix` should batch all state changes in a single `set()` call.
- If rename mode entry fails after file creation, the file still exists with its default name — this is acceptable and the user can rename it manually.

## Acceptance Criteria

- Secondary-clicking a directory row in the sidebar opens a native context menu.
- The menu includes `New File`, `New Folder`, `Copy relative path`, `Copy absolute path`, `Reveal in Finder` / `Reveal in Explorer` / `Show in Folder`, `Rename...`, and `Delete`.
- `New File` creates an untitled markdown file inside the folder and enters rename mode.
- `New Folder` creates an untitled subfolder and enters rename mode.
- Renaming a folder updates all open tab paths and history references within it.
- Deleting a folder removes it from the sidebar and cleans up all editor state for contained files.
- The feature uses Tauri native menu APIs consistent with the existing file context menu.
