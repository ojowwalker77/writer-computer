# Document Open Latency Spec

## Summary

Opening a document from the sidebar has a perceptible delay and a visible "Loading..." flash. The delay is concentrated on the **first-time open** of a file: a synchronous file read + parse, the resulting "Loading..." flash, and an eager syntax-tree parse with a 75 ms budget that runs on the main thread once the editor mounts. This spec eliminates the flash for fast loads, shrinks the parse block, and removes redundant per-render work so first-time opens feel instant.

## Goals

- Make first-time opens of typical documents (up to ~50 KB) feel instant on modest hardware: no "Loading..." flash, no visible input stall.
- Reduce the initial main-thread parse burst so it no longer blocks the first keystroke after a file open.
- Stop re-parsing frontmatter and re-scanning document content on every file activation.
- Keep tab switching between already-open files exactly as fast as it is today.

## Non-Goals

- Prefetching documents on hover or on sidebar focus.
- Moving parsing off the main thread into a Web Worker (larger project; revisit if this spec proves insufficient).
- Changing how files are persisted or how the watcher reloads them.
- Rewriting the CodeMirror extension set.
- Refactoring `EditorPane` to share a single `EditorView` across files. After reading the code, this turned out to be unnecessary — see "Architectural note" below.

## Architectural note

An earlier draft of this spec proposed a "primary fix" of reusing a single `CodeMirror` `EditorView` across file switches because the investigation believed the editor was being torn down and rebuilt on every selection. That was wrong. In the actual code:

- `editor-area/index.tsx` renders one `EditorPane` per unique file path in the tab list, keyed on `path`.
- `EditorPane` mounts `ProseMarkEditor` keyed on `${path}:${reloadVersion}` (`use-tabs.ts:55`). Since the pane is itself keyed on `path`, the path inside the pane never changes, so the editor key only changes when `reloadVersion` bumps (external file change via `reloadFromDisk`).
- `useProsemarkEditor` constructs the `EditorView` once when the pane DOM mounts, and destroys it only when the pane DOM unmounts (file closed and pruned from `panePaths`).

Switching between two already-open tabs is therefore just a CSS visibility flip. There is no editor recreation. The perceived "delay when selecting a doc" lives entirely on the **first-time open** path. This spec is scoped to that path.

A small follow-up worth tracking separately: today `reloadFromDisk` bumps `reloadVersion`, which forces the editor to remount. Replacing that with a `view.dispatch` that swaps the doc would make external file changes feel less jarring. This is _not_ part of this spec — it addresses a different perceived delay.

## Problem Detail

The current first-time-open path, starting at `components/sidebar/file-tree-node.tsx:72`:

1. `editor-store.ts:262` `openFile(path)` synchronously appends a tab and flips `activeTabId`/`activeFilePath`, then fires `ensureFileLoaded` without awaiting.
2. The new `EditorPane` mounts. Because the file is in `openFiles` with `isLoading: true`, `editor-pane.tsx:30-37` renders a "Loading..." placeholder.
3. `editor-store.ts:217-220` awaits `tauri.readFile`, then runs `parseDocument` synchronously (regex + YAML + h1 extraction). The store flips `isLoading: false`.
4. `EditorPane` re-renders without the placeholder; `ProseMarkEditor` mounts; `useProsemarkEditor` constructs the `EditorView` and wires extensions.
5. `use-prosemark-editor.ts:69-83, 348` calls `eagerlyAdvanceInitialParse`, which runs `forceParsing(view, view.state.doc.length, 75)` synchronously, blocking input for up to 75 ms.
6. Concurrently and on every subsequent activation, `document-header.tsx:25` re-parses frontmatter via `getFrontmatterDisplayDate`, and `editor-area/index.tsx:30` re-scans the full body via `getDocumentStats`.

Items (2), (5), and (6) are the dominant cost. (3) is unavoidable for cold reads but is what (2) is waiting on.

## Approach

### 1. Cache derived frontmatter/stats on the `OpenFile` record

- Extend `OpenFile` with two memoized fields populated whenever `frontmatter` or `content` changes:
  - `displayDate: string | null` — what `getFrontmatterDisplayDate` currently computes from frontmatter.
  - `stats: DocumentStats` — what `getDocumentStats` currently computes from body content.
- Recompute them inside the editor store:
  - On `ensureFileLoaded` resolve and `reloadFromDisk`: recompute both.
  - On `updateContent`: recompute `stats`.
  - On `updateFrontmatter` and the `updateTitle` branches that mutate frontmatter: recompute `displayDate`.
- `document-header.tsx` and `editor-area/index.tsx` read these fields directly via new selectors `useFileDisplayDate(path)` and `useFileStats(path)` instead of computing on every render.

### 2. Shrink and defer the initial parse

- Reduce `INITIAL_PARSE_BUDGET_MS` from 75 to ~20 ms. The viewport content is already rendered without the full tree; the remainder can finish in idle frames.
- Widen `MAX_FOLLOW_UP_PARSE_FRAMES` (e.g. 4 → 8) so the total parse budget is similar but distributed across `requestAnimationFrame` callbacks instead of the initial blocking burst.

### 3. Remove the "Loading..." flash for fast loads (grace window)

- In the editor store, restructure `openFile` so that for a file that is not yet loaded:
  1. Kick off `ensureFileLoaded(path)` immediately.
  2. Race the load promise against a `setTimeout` of `OPEN_FILE_GRACE_MS` (40 ms).
  3. If the load resolves first, the file content is already in the store before the tab is created — `EditorPane` mounts straight to the loaded state, no "Loading..." flash.
  4. If the timer fires first, create the tab anyway and fall back to today's behavior (the "Loading..." placeholder appears until the load resolves).
  5. If the load _fails_ before the grace fires, return without ever creating a tab.
- Files that are already loaded skip the grace window and create the tab synchronously, exactly as today.
- The launcher → file path (`replaceTabWithFile`) is unchanged.

## UX Decisions

- No spinner or placeholder for opens that resolve within the grace window — the tab appears with content already in place.
- Slow opens (> grace window) still show the existing "Loading..." placeholder; behavior is unchanged for that path.
- Cursor and scroll restore are unchanged.
- Tab switching between already-open files is unchanged.

## Implementation Notes

- **Grace window constant.** Define `OPEN_FILE_GRACE_MS = 40` near the top of `editor-store.ts`. 40 ms is well below the human perception threshold (~100 ms) so a fast disk read is invisible to the user. Reads slower than 40 ms fall through to the existing flash so the user always sees feedback.
- **Promise handling in the race.** When the grace fires before the load resolves, the load promise must keep running in the background. The simplest correct shape is to attach `loadPromise.catch(() => {})` once before the race to suppress unhandled rejections, then `await loadPromise` again after creating the tab so failures still propagate to `closeTab`. Re-use the same promise — `ensureFileLoaded` already deduplicates concurrent calls via `pendingLoads`, but reusing the local handle avoids the second lookup.
- **Selector reference stability.** `useFileStats` returns the cached `stats` object directly from the store. `getDocumentStats` already produces a fresh object on each invocation, so the reference identity changes once per content update — the same cadence as the previous `useMemo(() => getDocumentStats(content), [content])`. No additional render churn. Use a module-level `EMPTY_STATS` constant for the missing-file case so the selector is reference-stable when there's no file.
- **Cache invalidation.** Add small helpers `withDerivedDate`, `withDerivedStats`, `withDerived` in `editor-store.ts` that wrap the spread of an `OpenFile` and recompute the relevant cached fields. Use them at every site that builds a new `OpenFile` from an existing one with a content or frontmatter change. Missing one is a silent staleness bug, so audit all `files.set(path, { ...file, ... })` call sites.
- **Parse budget tuning.** 20 ms is a starting point. If the resulting follow-up frames don't catch up before the user's first keystroke on large documents, raise the initial budget back toward 30 ms — but never above ~30 ms or the input stall returns.
- **Scope discipline.** Do not touch unrelated CodeMirror extensions, sidebar code, or Rust commands. The Rust `read_file` command (`commands/fs.rs`) is not in scope — it is not the dominant cost and changing it risks the watcher path.

## Files Expected To Change

- `apps/desktop/src/stores/editor-store.ts` — add `displayDate`/`stats` to `OpenFile`, derived helpers, grace-window race in `openFile`.
- `apps/desktop/src/components/editor-area/use-prosemark-editor.ts` — lower `INITIAL_PARSE_BUDGET_MS`, raise `MAX_FOLLOW_UP_PARSE_FRAMES`.
- `apps/desktop/src/hooks/use-tabs.ts` — add `useFileDisplayDate` and `useFileStats` selectors.
- `apps/desktop/src/components/editor-area/document-header.tsx` — read cached `displayDate` from the store.
- `apps/desktop/src/components/editor-area/index.tsx` — read cached `stats` from the store; drop the `useMemo` and `getDocumentStats` import.

## Acceptance Criteria

- First-time opens of a ~10 KB markdown file from the sidebar show no "Loading..." placeholder on a dev machine — the tab appears with content already in place.
- Slow opens (e.g. an SSD under load or a very large file) still show the existing placeholder and behave as before.
- Tab switching between already-open files is unchanged: no flicker, no recompute, no editor recreation.
- After opening a file, the first keystroke is accepted without a perceptible input stall on a typical document.
- `getFrontmatterDisplayDate` and `getDocumentStats` are not invoked on tab activation for already-loaded files; they only run when the underlying `frontmatter` or `content` changes.
- Cursor and scroll position are restored correctly when switching back to a previously-viewed file.
- External file changes (`reloadVersion` bump) still cause the editor to refresh.
- No regressions in: image paste, wiki link resolution, frontmatter paste handling, syntax highlighting, table/HTML block decorations.
