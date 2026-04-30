# Workspace Switch Hang Spec

## Summary

Fix the "app not responding" state that can occur when switching workspaces — especially while the previous workspace is still indexing. This is a focused, low-risk PR that adds cancellation, a workspace epoch, and a watcher guard on top of today's `AppState`. No data-structure rewrite; the larger redesign lives in a follow-up (`SPECs/workspace-snapshot-spec.md`).

## Goals

- `open_workspace` / `restore_workspace` IPC returns promptly regardless of outgoing workspace size, including mid-index.
- Background work from a previous workspace stops promptly when the user switches, instead of running to completion.
- Watcher events from a stale workspace never mutate the new workspace's `AppState`.
- No user-visible "not responding" title-bar state under rapid A→B→A→B switching between large vaults.

## Non-Goals

- Replacing `IndexedFile` / `dirs_with_markdown` / `Vec`-based storage. That's the snapshot spec.
- Changing frontend event names or wire format.
- Changing fuzzy search, sidebar rendering, or title extraction behavior.
- Persisting any state across restarts.

## Root Causes In The Current Code

Four issues combine to produce the hang:

1. **No cancellation in the walker.** `index_workspace_impl` (`apps/desktop/src-tauri/src/commands/search.rs:107`) runs the parallel `ignore::WalkBuilder` to completion. Switching A→B during a slow A scan stacks a second walker on top — up to 16 threads total competing for disk I/O and the OS file cache. The `workspace_root` check at `apps/desktop/src-tauri/src/commands/workspace.rs:112` only prevents the stale _write_; it doesn't stop the walk.

2. **Watcher has no workspace-ID guard.** The watcher's processing loop (`apps/desktop/src-tauri/src/watcher.rs:113-275`) mutates `state.file_index` and `state.dirs_with_markdown` based purely on incoming events. Events queued while workspace A was active can push A-path entries into workspace B's index after the swap.

3. **Synchronous watcher lifecycle on the IPC thread.** `prepare_workspace_state` drops the old `RecommendedWatcher`, creates a new one with `RecursiveMode::Recursive`, and takes four write locks — all before returning. Any contention from the old indexer or the old watcher thread surfaces as an IPC that blocks the frontend's `await`.

4. **`read_directory_impl` holds the `workspace_ignore` read lock across per-file I/O.** `apps/desktop/src-tauri/src/commands/fs.rs` kept the `RwLockReadGuard` alive for the full scan — through every `extract_title` call, which opens and reads 4 KB per `.md` file. A slow directory (many files, iCloud placeholders, sluggish disk) holds the guard for hundreds of milliseconds. When the user then switches workspaces, `prepare_workspace_state`'s `*workspace_ignore.write() = Some(bootstrap())` waits for that reader — and the IPC thread freezes mid-switch. This was the _dominant_ hang in practice; the other three above were secondary.

## Approach

Three additive changes on top of today's `AppState`. No structural rewrite.

### 1. Workspace epoch

Add one atomic to `AppState`:

```rust
pub workspace_epoch: AtomicU64,
```

Incremented inside `prepare_workspace_state` before any reset or background spawn. Every background task captures the epoch at launch and re-checks it before writing. If it has moved, the task drops its results and returns.

Replaces the existing "is `workspace_root` still equal?" checks at `workspace.rs:91` and `workspace.rs:112`, which race on `PathBuf` comparisons and don't cover the watcher.

### 2. Cancellation flag in the walker

Add one `Arc<AtomicBool>` to `AppState`:

```rust
pub cancel_index: RwLock<Arc<AtomicBool>>,
```

On workspace switch, set the prior flag to `true` and install a fresh one for the new workspace. `index_workspace_impl` accepts a cancel flag and returns `ignore::WalkState::Quit` from the walker callback when it flips. Loads of ignore matchers (`WorkspaceIgnore::load`) also check it between directories.

Effect: the old walker returns within a directory boundary — milliseconds, not seconds — instead of running to the end of the tree.

### 3. Watcher captures the epoch

`start_watcher` captures the current `workspace_epoch` value into its closure. Every mutation the watcher applies (`state.file_index.write()`, `state.dirs_with_markdown.write()`, `state.workspace_ignore.write()`, and the emitted events) re-reads the live epoch and no-ops if it doesn't match the captured value.

Also: move the old watcher's `Drop` off the IPC thread. `notify::RecommendedWatcher::Drop` can briefly block on FSEvents unregister; detach it into a short-lived background thread so the IPC returns without waiting.

### 4. Never hold `workspace_ignore` across I/O

In `read_directory_impl` and `dir_contains_markdown`, snapshot the matcher under a brief read lock and drop the guard before any file system access:

```rust
let ignore_arc: Option<Arc<WorkspaceIgnore>> =
    state.and_then(|s| s.workspace_ignore.read().as_ref().map(Arc::clone));
let ignore_matcher: Option<&WorkspaceIgnore> = ignore_arc.as_deref();
// ... now do the slow walk + `extract_title` calls without any lock held.
```

`Arc<WorkspaceIgnore>` is specifically designed for this: cloning the Arc is O(1) and keeps the matcher alive for the duration of the caller; the lock is only needed to snapshot the pointer, not to use the matcher. The prior code's comment ("guard is cheap to hold") was wrong — the guard is cheap in memory but expensive in contention, because it blocks any writer trying to swap the matcher (which is exactly what `prepare_workspace_state` does on every workspace switch).

### What `prepare_workspace_state` looks like after

Synchronous work on the IPC thread:

1. Validate path.
2. Bump `workspace_epoch`.
3. Flip the old `cancel_index` flag to `true`; install a new one.
4. Swap `workspace_root`.
5. Install the bootstrap `WorkspaceIgnore` (unchanged).
6. Persist to recents.
7. Return.

Everything else — drop old watcher, start new watcher, load full ignore matcher, walk the tree — moves to the background thread, guarded by the captured epoch.

## Files Expected To Change

- `apps/desktop/src-tauri/src/state.rs` — add `workspace_epoch: AtomicU64` and `cancel_index: RwLock<Arc<AtomicBool>>`.
- `apps/desktop/src-tauri/src/commands/workspace.rs` — bump epoch on switch, flip cancel flag, move watcher lifecycle + ignore load to background.
- `apps/desktop/src-tauri/src/commands/search.rs` — thread the cancel flag through `index_workspace_impl` and the walker callback.
- `apps/desktop/src-tauri/src/commands/fs.rs` — snapshot `Arc<WorkspaceIgnore>` under brief read lock in `read_directory_impl` and `dir_contains_markdown`; never hold the guard across I/O.
- `apps/desktop/src-tauri/src/watcher.rs` — capture epoch in `start_watcher`; guard all `AppState` mutations and event emissions; off-thread watcher drop helper.
- Rust unit tests: cancel-flag short-circuits a walk; epoch invalidation drops stale writes; watcher drops events whose captured epoch doesn't match.

## Acceptance Criteria

- `open_workspace` / `restore_workspace` IPC returns in <50 ms on an M-series Mac regardless of outgoing workspace size, measured with `dev-startup-telemetry` instrumentation against a 10k-file outgoing workspace that is still mid-index.
- No "not responding" title-bar state observable when rapidly switching A→B→A→B between two large vaults (manual QA).
- A test that starts workspace A's scan, immediately switches to workspace B, and asserts: (a) A's walker exits within 50 ms of the flag flip, (b) the final `file_index` contains zero A-path entries, (c) `index:complete` fires for B with the expected count.
- A test that injects a late watcher event tagged with A's captured epoch after B is installed and asserts it does not appear in B's `file_index`.
- Existing behavior preserved: titles still extracted per folder during `read_directory` (unchanged); `fs:directory-changed` / `fs:file-changed` / `index:complete` event names and payloads unchanged.
