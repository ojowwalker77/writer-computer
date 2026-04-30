# Editor Tab Switch Performance Spec

## Summary

Stop remounting CodeMirror every time a tab navigates or a file reloads, and stop forcing full-document parsing when only the viewport is visible. Together these eliminate the "parse/render hitch" users feel when switching tabs, navigating back/forward, or clicking a wiki-link — especially on large documents.

Today the `EditorPane` architecture is mostly sound (all open tabs are mounted, only the active one is visible). Three code-level choices undo that architectural win:

1. **Panes are keyed by file path** (`apps/desktop/src/components/editor-area/index.tsx:64`). When a tab navigates A→B and no other tab still references A, React unmounts A's pane and mounts B's. CodeMirror is destroyed and recreated for every navigation.
2. **`editorKey` includes `reloadVersion`** (`apps/desktop/src/hooks/use-tabs.ts:67`). Whenever disk content changes — self-save round-trip, external editor write — the key changes, React remounts, CodeMirror is destroyed and rebuilt.
3. **Initial parse targets the whole document** (`apps/desktop/src/components/editor-area/use-prosemark-editor.ts:75`). `forceParsing(view, view.state.doc.length, 20 ms)` plus 8 `requestAnimationFrame` follow-ups spends up to ~150 ms parsing off-screen content before the first paint settles. On a 10 k-line doc with tables or HTML blocks this produces the visible "raw markdown flashes, then renders correctly" effect plus layout shift.

Fix all three. Measured budget for navigating to a large doc drops from ~200–650 ms of observable work to ~15–30 ms.

## Goals

- **Navigating within a tab** (back, forward, wiki-link click, sidebar click that retargets the active tab) does not unmount the editor. Per-file cursor and scroll are preserved across swaps.
- **External file changes** (self-save round-trip, `vim` save) update the editor content in place. Cursor is preserved (clamped if beyond the new doc length).
- **First view of a large document** paints the visible viewport within ~2 frames, with correct syntax highlighting for the visible region. Off-viewport regions continue parsing lazily.
- **Tab-bar switches between already-mounted tabs** remain visually free (already true today; this spec preserves it).

## Non-Goals

- Replacing CodeMirror or the Lezer markdown grammar.
- Moving parsing to a Web Worker. Possible future work; the browser-main-thread wins below are enough for documents Writer users actually write.
- Pre-warming inactive tabs during idle. Speculative; defer until metrics show it's needed.
- Self-write suppression at the watcher level (the frontend already short-circuits when `content === diskContent`). If remaining edge-case reloads are observed after this spec lands, address them in a small follow-up — not here.
- Adding a hover-prefetch for files referenced in wiki-links. Separate concern, separate spec if pursued.
- Changing the `EditorPane` "all tabs mounted, invisible when inactive" pattern. It's correct.

## Approach

Three tightly-coupled changes. They ship as one PR because splitting them would leave intermediate states with worse correctness (a tab-keyed pane still remounting on navigation is strictly worse than today).

### 1. Pane lifecycle is bound to the tab, not the file

Change `editor-area/index.tsx` from one pane per unique path to one pane per open tab:

```tsx
// Before
panePaths.map((path) => (
  <EditorPane key={path} filePath={path} isActive={path === activeFilePath} />
));

// After
tabs
  .filter(isFileTab)
  .map((tab) => <EditorPane key={tab.id} tabId={tab.id} isActive={tab.id === activeTabId} />);
```

`EditorPane` takes `tabId` instead of `filePath`. Internally the pane reads the tab's current path via a new domain hook (`useTabCurrentPath(tabId)` — see "State access" below) and passes it down. When the tab navigates A→B, the pane doesn't unmount — the hook returns a new path and the editor hook (§2) reacts.

**Consequence**: multiple tabs viewing the same file get their own CodeMirror instance. Today they share one. This is a behavior change — but a correct one. Per-tab cursor/scroll should actually be per-tab; today two tabs pointing at the same file fight over the same cursor.

### 2. Content swap on path or reload change

Inside `useProsemarkEditor`, subscribe to the current path and its content. When either changes:

```ts
function swapDocument(view, nextContent, nextCursor, nextScroll) {
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: nextContent },
    selection:
      nextCursor != null
        ? EditorSelection.cursor(Math.min(nextCursor, nextContent.length))
        : undefined,
    userEvent: "writer.reload",
    scrollIntoView: false,
  });
  if (nextScroll != null) {
    requestAnimationFrame(() => {
      if (isDisposed()) return;
      scrollContainer?.scrollTo(0, nextScroll);
    });
  }
}
```

Two trigger conditions, handled the same way:

- **Path changed** (in-tab navigation): save the outgoing file's cursor/scroll to the store (already happens via the existing change listener), read the incoming file's cursor/scroll, dispatch the swap.
- **`reloadVersion` bumped** (same path, new disk content): dispatch the swap. Cursor stays where the user left it, clamped by the dispatch.

Change listeners key on `tr.isUserEvent("writer.reload")` to skip marking the file dirty. Existing listeners that _do_ care about external edits (e.g. decorations) still fire — `changes` are real changes; we're only annotating the intent.

**On swap failure** (view disposed mid-dispatch): log at `warn` level with the path, don't silently retry. The next render will re-attempt via the same subscription.

**Drop the 50%-content-different fallback** that an earlier draft mentioned. The swap handles all cases; any heuristic threshold is a silent behavior change and violates "fail explicitly" from the project guardrails.

### 3. Viewport-only initial parse

Replace `eagerlyAdvanceInitialParse` (the 20 ms synchronous burst + 8 rAF follow-ups targeting `doc.length`) with:

```ts
function advanceViewportParse(view, isDisposed) {
  const viewport = view.viewport;
  // Small overshoot so quick scroll doesn't reveal unparsed content.
  const target = Math.min(view.state.doc.length, viewport.to + VIEWPORT_OVERSHOOT);
  forceParsing(view, target, VIEWPORT_PARSE_BUDGET_MS);
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(
      () => {
        if (isDisposed()) return;
        forceParsing(view, view.state.doc.length, IDLE_PARSE_BUDGET_MS);
      },
      { timeout: IDLE_PARSE_TIMEOUT_MS },
    );
  }
}
```

Suggested budgets:

- `VIEWPORT_OVERSHOOT`: 2000 characters (a screen's worth plus margin).
- `VIEWPORT_PARSE_BUDGET_MS`: 50. Enough for even complex tables; small enough to not be a frame hitch if work is lighter.
- `IDLE_PARSE_BUDGET_MS`: 50.
- `IDLE_PARSE_TIMEOUT_MS`: 2000.

Run this after every swap (§2) too, not just on mount, so a freshly-swapped viewport is parsed before the user could perceive unparsed content. On same-file reloads (self-save), the incremental parser reuses almost the entire tree and this completes in single-digit milliseconds.

If `requestIdleCallback` never fires (busy browser), CodeMirror's default behavior still parses on scroll. Off-viewport parsing is never blocking.

### State access — routed through `@/hooks`, not `stores/`

Per `docs/react-guidelines.md`, component-colocated hooks must not import from `stores/` directly. Add to `apps/desktop/src/hooks/use-tabs.ts`:

```ts
export function useTabCurrentPath(tabId: string) {
  return useEditorStore((s) => {
    const tab = s.tabs.find((t) => t.id === tabId);
    return tab?.kind === "file" ? tab.currentPath : null;
  });
}

export function useCurrentContent(path: string | null) {
  return useEditorStore((s) => (path ? (s.openFiles.get(path)?.content ?? null) : null));
}

export function useReloadVersion(path: string | null) {
  return useEditorStore((s) => (path ? (s.openFiles.get(path)?.reloadVersion ?? 0) : 0));
}
```

Each hook selects a single slice (per `docs/zustand.md`'s "one selector per hook"). `useProsemarkEditor` composes them and handles the swap. Imperative access (e.g. reading cursor/scroll at swap time without re-renders) goes through `@/hooks/editor-api.ts`, which already follows this pattern.

### Action vs. watcher tradeoff — acknowledged

`docs/react-guidelines.md` prefers side effects in actions over watchers. The swap-on-store-change pattern here is a watcher: the pane's hook observes `reloadVersion` and content, then calls into a CodeMirror view it owns.

The alternative — having the store's `reloadFromDisk` action dispatch directly into the view — requires the store to hold a reference to each live CodeMirror view, coupling the state layer to the editor implementation. That's strictly worse: the store becomes unserializable and per-pane wiring leaks across the store boundary.

This spec accepts the watcher pattern as the better-scoped tradeoff. The subscription is narrow (two hooks), contained within the editor hook, and disposed cleanly on unmount.

## Measurement

Add timing marks (reuse `@/lib/startup-metrics` or a sibling `editor-metrics.ts`):

- `nav-dispatch` → swap transaction fired
- `nav-paint` → `requestAnimationFrame` after the dispatch
- `mount-start` → `useProsemarkEditor`'s first effect
- `viewport-parsed` → `forceParsing` returned `true` for the viewport target

Target budgets on an M-series Mac, 10 k-line document:

- `nav-dispatch → nav-paint`: **< 16 ms** for in-tab navigation (same-file reload or file-to-file swap).
- `mount-start → viewport-parsed`: **< 32 ms** for first-ever view of a tab.
- Tab-bar switching between already-mounted tabs: unchanged, stays < 16 ms.

## Files Expected To Change

- `apps/desktop/src/components/editor-area/index.tsx` — render one `EditorPane` per tab, keyed by `tab.id`.
- `apps/desktop/src/components/editor-area/editor-pane.tsx` — accept `tabId` instead of `filePath`; resolve path via hook.
- `apps/desktop/src/components/editor-area/use-prosemark-editor.ts` — subscribe to currentPath + content + reloadVersion, implement `swapDocument`, replace `eagerlyAdvanceInitialParse` with `advanceViewportParse`, run it on mount and after each swap.
- `apps/desktop/src/components/editor-area/prosemark-editor.tsx` — forward `tabId`/`filePath` appropriately.
- `apps/desktop/src/hooks/use-tabs.ts` — add `useTabCurrentPath`, `useCurrentContent`, `useReloadVersion` (each a single-slice selector).
- `apps/desktop/src/hooks/editor-api.ts` — add imperative `getCursorScroll(path)` so swap can read current positions without a subscription.
- `apps/desktop/src/lib/startup-metrics.ts` _or_ new `apps/desktop/src/lib/editor-metrics.ts` — the four marks above.

## Testing

- **Unit (use `@testing-library/react` + a test CodeMirror view)**: swap preserves cursor, applies `writer.reload` user event, change listeners don't mark file dirty on reload, viewport-parse completes within budget on a synthetic doc.
- **Integration (Testing Library)**: open two file tabs, navigate one from A→B, assert the pane's root DOM node reference is stable across the navigation (proves no remount).
- **Manual**: open a 10 k-line markdown file (e.g. the CodeMirror test corpus), record the `nav-dispatch → nav-paint` timing on first view, externally edit the file in another editor, confirm the editor updates in place without a flicker.

## Acceptance Criteria

- Navigating within a tab (back/forward, wiki-link click) does not unmount `EditorPane`. Verifiable by a ref-equality assertion in a Testing Library test.
- External save (same path, new content) updates the editor in place. Cursor is preserved (clamped if past new doc end). Scroll is preserved.
- Self-save round-trip produces no visible flicker.
- First view of a 10 k-line markdown file paints its viewport within 32 ms of the tab becoming active. Off-viewport syntax highlighting may still be filling in; this is acceptable.
- Tab-bar switches between already-mounted tabs have no paint hitch.
- No regressions: context menus, frontmatter panel, decorations (tables, HTML blocks, wiki-links, table-decorations, html-block-decorations), native menu integration, search inside document, scroll restoration, and focus-on-active all continue to work.
- New hooks (`useTabCurrentPath`, `useCurrentContent`, `useReloadVersion`) each select a single slice; no component or editor-area hook imports from `stores/` directly.
- Two tabs pointing at the same file each have their own CodeMirror instance and their own independent cursor/scroll state (behavior change from today, called out in the PR description).
