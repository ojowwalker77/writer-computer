# Archive Files Spec

## Summary

Add an archive concept: instead of deleting a file outright, the user can archive it. Archived files move to a `.writer/archive/` directory inside the workspace and are auto-purged after ~30 days.

## Goals

- Provide a soft-delete option that is recoverable for a window of time.
- Surface archived files in a dedicated view for restore.
- Auto-purge after ~30 days to keep the archive bounded.
- Keep the implementation contained to the workspace itself (no cloud, no DB).

## Non-Goals

- Cloud-synced trash.
- Selective per-file retention windows in v1.
- Versioning of restored files.

## Storage Layout

- Archive directory: `<workspace>/.writer/archive/`
- Each archived file is stored under a timestamped filename (e.g., `2026-04-07T12-34-56-abcd1234__original-name.md`) plus a sidecar `.json` capturing original path, archive timestamp, and (if open) any unsaved buffer state.
- A single `.writer/archive/index.json` keeps metadata for fast listing.

## UX Decisions

### Archiving

- Add `Archive` to the file context menu (above `Delete`).
- Archive does not require confirmation.
- Archive closes any open tabs for the file and prunes its history references (reuse `removePathReferences`).

### Browsing the archive

- New `Archive` view accessible from the sidebar header (small icon or menu item).
- Lists archived files newest first with original path, archive date, and "expires in N days".
- Each row supports `Restore` and `Delete forever`.

### Restore

- Restore writes the file back to its original path.
- If a file already exists at that path, restore prompts for a new name.
- Restore re-indexes the workspace and opens the restored file in a new tab.

### Auto-purge

- A daily timer (also runs on app launch) deletes archive entries older than 30 days.
- Purges are silent.

## Implementation Notes

- Add Rust commands `archive_file`, `list_archive`, `restore_archive_entry`, `purge_archive`.
- Run the purge job from a Tauri scheduled task or from a frontend `useEffect` on launch.
- Store the index in JSON to keep crash recovery simple.
- The archive directory must be excluded from the workspace file index, watcher, and search.

## Files Expected To Change

- `apps/desktop/src-tauri/src/commands/archive.rs` (new)
- `apps/desktop/src-tauri/src/lib.rs`
- `apps/desktop/src-tauri/src/state.rs`
- `apps/desktop/src/components/sidebar/`
- `apps/desktop/src/components/archive-view.tsx` (new)
- `apps/desktop/src/lib/tauri.ts`
- frontend and Rust tests

## Acceptance Criteria

- A user can archive a file from the sidebar context menu and the file disappears from the tree.
- The Archive view lists archived files with restore and delete-forever actions.
- Restoring puts the file back at its original path and reopens it.
- Files older than 30 days are purged automatically.
