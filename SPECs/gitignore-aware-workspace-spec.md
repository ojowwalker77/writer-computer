# Gitignore-Aware Workspace Spec

## Summary

Honor `.gitignore` (and friends) when indexing and watching the workspace. Today Writer scans every directory under the workspace root, which floods the sidebar with `node_modules/`, `dist/`, and other generated content for users who open code repos as their workspace.

## Goals

- Skip `.gitignore`-ignored paths during file indexing, watching, and fuzzy search.
- Skip them in the sidebar tree as well.
- Match Git's resolution rules closely enough that the experience is unsurprising.
- Apply the rules incrementally as `.gitignore` files are added or changed.

## Non-Goals

- Implementing a Git-correct ignore engine from scratch — use a vetted crate.
- Honoring per-user global gitignore files in v1.
- Adding a UI to override or toggle ignored visibility in v1.

## Approach

- Use the `ignore` crate (the same one `ripgrep` uses) on the Rust side.
- Apply ignore rules in the workspace indexer, the file watcher, and the search command.
- Cache the resolved ignore matcher per workspace and rebuild when any `.gitignore` file changes.

## UX Decisions

- The sidebar should not show ignored entries at all in v1.
- Hidden dotfiles remain hidden as today.
- The `.gitignore` file itself stays visible.
- Searches and fuzzy file picker results must respect the same filter so the sidebar matches search results.

## Implementation Notes

- Build the ignore matcher in `state.rs` or a new `ignore.rs` module.
- Expose a thin helper `is_ignored(path) -> bool` and call it from the indexer, watcher, search, and any directory listing command.
- Watcher must invalidate and rebuild the matcher when any `.gitignore`, `.git/info/exclude`, or workspace root `.gitignore` changes.

## Files Expected To Change

- `apps/desktop/src-tauri/Cargo.toml` (add `ignore` crate)
- `apps/desktop/src-tauri/src/state.rs`
- `apps/desktop/src-tauri/src/watcher.rs`
- `apps/desktop/src-tauri/src/commands/fs.rs`
- `apps/desktop/src-tauri/src/commands/search.rs`
- `apps/desktop/src-tauri/src/commands/workspace.rs`
- new `apps/desktop/src-tauri/src/ignore.rs`
- Rust unit tests under `apps/desktop/src-tauri/`

## Acceptance Criteria

- Opening a workspace that contains `node_modules/` and a `.gitignore` listing it does not show `node_modules/` in the sidebar.
- Search does not return matches from ignored directories.
- Editing the workspace `.gitignore` to ignore a previously visible folder removes it from the sidebar without restarting the app.
- Editing it to un-ignore a folder makes it visible again.
