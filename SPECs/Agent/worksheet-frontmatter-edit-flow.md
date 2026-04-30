# Worksheet — Frontmatter Edit Flow

## References

- TODO: `TODOS.md` → **In Progress** → "Frontmatter edit flow"
- Spec: [`SPECs/frontmatter-edit-flow-spec.md`](../frontmatter-edit-flow-spec.md)
- Workflow: [`docs/workflows/agent-loop.md`](../../docs/workflows/agent-loop.md)

## Investigation

### Files reviewed

- `apps/desktop/src/components/editor-area/use-prosemark-editor.ts` — `handleFrontmatterStart` (lines 141–160). Detects `---` typed as the third char on line 1 of a file with no frontmatter, calls `editorApi.updateFrontmatter(path, "")`, strips the `--` from the editor doc, preventDefaults.
- `apps/desktop/src/components/editor-area/use-frontmatter-entries.ts` — owns `localEntries` state, syncs from store via `lastFrontmatterRef`, serializes entries back to YAML and pushes via `updateFrontmatter(yaml)`. Empty `commitEntries([])` currently writes `""`, leaving `hasFrontmatter === true`.
- `apps/desktop/src/components/editor-area/frontmatter-panel.tsx` — renders input rows + `Add property` button. Backspace on empty row is gated by `entries.length > 1`, which blocks deleting the final row via keyboard.
- `apps/desktop/src/hooks/use-frontmatter.ts` — already exposes `removeFrontmatter()` that resolves to `updateFrontmatter(path, null)`.
- `apps/desktop/src/lib/yaml-entries.ts` — `serializeYamlEntries` filters out entries with empty keys (so a single seeded empty row serializes to `""`). `parseYamlEntries("")` returns `[]`.
- `apps/desktop/src/stores/editor-store.ts` — store. `updateFrontmatter` already re-runs `inferTitle`, so flipping to `null` is correctly handled.

### Key observations

1. When the `---` gesture runs, the panel mounts with `hasFrontmatter === true` but `localEntries === []` because `parseYamlEntries("")` returns `[]`. The seed must be **explicit** — we can't derive "just created" from the stored frontmatter value alone.
2. To distinguish "the user just opened a new frontmatter block" from "the user loaded a file that happens to have an empty frontmatter block", we need a transient signal from `handleFrontmatterStart`. Store-based is the idiomatic choice (codebase has zero `CustomEvent` usage; everything non-local flows through Zustand).
3. `commitEntries` is the single place where local entry state is mirrored back to the store. Routing the empty-commit branch through `removeFrontmatter()` keeps the change small and affects every remove path (button click, Backspace, future programmatic).
4. After `removeFrontmatter()` the panel unmounts (`hasFrontmatter === false`). The user's focus can't go to "the next key input" because there isn't one — the editor regains focus naturally via the unmount. No extra handling needed.

### Approach picked

Store flag. Alternative (DOM `CustomEvent`) rejected — inconsistent with existing patterns.

## Plan (revised after plan review)

Plan review (React + Zustand + UX personas) flagged two P1 issues and several P2s. The revised plan below incorporates them.

### 1. `apps/desktop/src/stores/editor-store.ts`

- Add `pendingFrontmatterEdit: string | null` to `EditorState` (initial `null`). Single-slot is sufficient because `handleFrontmatterStart`'s upstream guard (`file.frontmatter !== null`) prevents double-trigger on the same file, and all `EditorPane`s stay mounted while their tab is open so no panel can "miss" a flag and see it re-surface later.
- Actions on `EditorActions`:
  - `beginFrontmatterEdit(path: string)` — sets the field.
  - `consumeFrontmatterEdit(path: string)` — clears the field iff its current value equals `path`. Idempotent for Strict Mode double-invocation.

### 2. `apps/desktop/src/hooks/editor-api.ts`

- Export `beginFrontmatterEdit(path)`. `consumeFrontmatterEdit` is used directly via `useEditorStore.getState()` in the UI hook.

### 3. `apps/desktop/src/components/editor-area/use-prosemark-editor.ts`

- After `editorApi.updateFrontmatter(filePath, "")` in `handleFrontmatterStart`, call `editorApi.beginFrontmatterEdit(filePath)`.

### 4. `apps/desktop/src/components/editor-area/use-frontmatter-entries.ts`

- Read `pendingFrontmatterEdit` via a selector (scalar, auto-bails-out — no `useShallow` needed).
- Detect the transition `pendingEdit !== filePath → pendingEdit === filePath` using a ref guard (`seenPendingRef`). On the matching render:
  - Seed `localEntries = [{ key: "", value: "", isComplex: false }]` (same shape `addEntry` produces).
  - Set `seedActiveRef.current = true`. The store-sync render-time branch checks this ref and skips its clobber while a seed is active; the ref clears when a real frontmatter change (non-"") arrives or when the user edits an entry (commit path).
  - Set `autofocusRef.current = true`.
  - Call `useEditorStore.getState().consumeFrontmatterEdit(filePath)` **synchronously in the render branch** — this is a store write (not a `setState`) so it's safe during render, and closes the pre-consume window where a concurrent re-render could double-seed or the flag could leak across component lifecycle quirks (both flagged in review).
  - Update `seenPendingRef.current = pendingEdit`.
- Widen `lastFrontmatterRef` to `string | null` so the empty-removal bail-out is explicit (`null` ref value vs. `null` store value) even if `useFrontmatter`'s `?? ""` normalization is later changed.
- Change `commitEntries`: when `next.length === 0`:
  - Set `seedActiveRef.current = false`, `lastFrontmatterRef.current = null`.
  - Call `removeFrontmatter()`.
  - Try to return focus to the editor by calling `focus()` on the active `.cm-editor.cm-focused .cm-content` (or the first `.cm-editor .cm-content` in the document) after a `requestAnimationFrame`. If neither is present the user ends up on `<body>` — acceptable fallback.
- Otherwise: keep the existing `updateFrontmatter(yaml)` path and clear `seedActiveRef` so subsequent syncs work normally.
- Return `autofocusRef` as-is (a ref) from the hook so the panel can read + clear it.

### 5. `apps/desktop/src/components/editor-area/frontmatter-panel.tsx`

- Read the `autofocusRef` from the hook. In a `useEffect` that runs every render (no deps — cheap), if `autofocusRef.current` is true:
  - Set `autofocusRef.current = false`.
  - Schedule `requestAnimationFrame(() => containerRef.current?.querySelector<HTMLInputElement>('[data-field="key"]')?.focus())`.
  - Return a cleanup that calls `cancelAnimationFrame(id)` to handle mid-frame unmount.
- Drop the `entries.length > 1` guard in the Backspace handler so the final empty row can be deleted. Also guard the Backspace handler's follow-up focus RAF with `next.length > 0` so we don't try to focus a stale input when the panel is about to unmount.

### 6. Tests

- Extend `apps/desktop/tests/stores.test.ts`:
  - `beginFrontmatterEdit(path)` sets `pendingFrontmatterEdit` to `path`.
  - `consumeFrontmatterEdit(path)` clears only the matching path; calling with a mismatched path is a no-op.
  - `updateFrontmatter(path, null)` path flips `hasFrontmatter` to false, marks the file dirty, and re-infers title (proxy for the `commitEntries([])` → `removeFrontmatter()` chain).
- No unit test for the render-time ref dance — it's better verified in-browser. Called out as a residual gap.

### Risks / edge cases (updated)

- **Strict Mode double-invocation.** Both ref-gated branches (seed + consume) are idempotent. The second render sees `seenPendingRef.current === pendingEdit`, the second `consumeFrontmatterEdit` sees `current !== path` (already cleared by the first), both are no-ops.
- **A → B → A re-entry.** Because every `EditorPane` is mounted (active and inactive), the consume happens during the first render of A's panel after `beginFrontmatterEdit`. By the time the user tabs away and back, the flag is already cleared. If the test ever changes to mount only the active pane, the mitigation is to also clear `pendingFrontmatterEdit` in `closeFile`/`reloadFromDisk` — noted as a follow-up.
- **Empty seeded row committed to an empty YAML.** `serializeYamlEntries([seededEmptyRow])` filters out the empty-key entry and returns `""`. We deliberately do **not** call `commitEntries` during seed (only `setLocalEntries`), so the store's frontmatter stays `""` until the user types a key. Good.
- **User presses Backspace immediately on the seeded row.** Key and value are both empty; the existing Backspace handler fires `removeEntry(0)` → `commitEntries([])` → `removeFrontmatter()` → panel unmounts. The editor refocus RAF fires after the panel DOM is gone (querySelector runs against `document`, finds the active `.cm-content`, focuses it). Intended behavior — type `---`, abandon immediately, end up back in the editor.
- **Pending flag stale across fast file switches.** Not reachable in the current arch since inactive panes stay mounted (see above).

## Validation plan

- `vp check`, `vp test` pass.
- Manual in-browser: create a file with no frontmatter, type `---`, verify first key input is focused. Type key+value, Enter, type another, delete all, verify saved file has no `---` block and focus lands back in the editor.

## Validation plan

- `vp check`, `vp test` pass.
- Manual in-browser: create an empty file, type `---`, verify the first key input is focused. Type key+value, Enter, type another, delete all, verify saved file has no `---` block.

## Implementation log

- Plan review (React + Zustand + UX personas) flagged two P1s:
  1. `autofocusPending` state → replaced with `autofocusRef` (ref, not state). Matches the existing `lastFrontmatterRef` pattern.
  2. `consumeFrontmatterEdit` synchronous in render → initially kept during render with ref-guard, but the implementation review re-flagged this as a concurrent-render violation. Moved to a post-commit `useEffect`. `consumeFrontmatterEdit` is idempotent (no-op when current value doesn't match), so running on every `[pendingEdit, filePath]` change is safe.
- Added `pendingFrontmatterEdit` clearing to `closeTab` so a stale flag left by closing a tab mid-creation (spec edge case under "rapid file switching") doesn't stranded-seed the file next time it's opened.
- Added store tests: `beginFrontmatterEdit`/`consumeFrontmatterEdit` round-trip, `updateFrontmatter(path, null)` re-infers title and flips `hasFrontmatter`, `closeFile` clears the pending flag.
- Updated `beforeEach` in `stores.test.ts` to reset `pendingFrontmatterEdit` so test-order isolation is explicit.

## Known gaps (follow-ups for later)

- No hook-level test for the seed / autofocus / remove-on-empty paths. `@testing-library/react` isn't installed; adding it is scope creep. Manual browser verification covers the feature for now.
- Multi-tab refocus: `commitEntries([])` queries `.cm-content` document-wide. In multi-tab layouts with no focused editor, the first-in-DOM fallback may focus the wrong tab's editor. Acceptable vs. the `<body>` alternative. Could be tightened by anchoring to the panel's enclosing pane.

## Refactor — from store flag to state machine

After the first implementation landed, a guideline audit against `docs/react-guidelines.md` and `docs/zustand.md` flagged: (1) direct `useEditorStore` import in the co-located hook, (2) `getState()` for imperative access instead of `editorApi`, and (3) a `useEffect` watcher pattern for consuming the pending flag.

Rather than paper over those with partial fixes, the panel was refactored as a small state machine over rows:

- Placeholder row (both fields empty) vs. committed row (key non-empty).
- `autoFocus` on the key input triggers on mount for placeholder rows. React's native prop — no refs, no effects.
- `onBlur` filters relatedTarget inside the same row (Tab key↔value), then removes the row if its key is empty.
- `commitEntries([])` → `removeFrontmatter()` → `requestAnimationFrame` editor refocus.

Removed as a consequence: `pendingFrontmatterEdit` store field + `beginFrontmatterEdit` / `consumeFrontmatterEdit` actions, the `editorApi` export, the `handleFrontmatterStart` signaling call, the `closeTab` cleanup branch, the `seenPendingRef` / `seedActiveRef` / `autofocusRef` refs, the consume `useEffect`, and two obsolete store tests.

Tradeoff accepted: a file that ships with an empty `---\n---\n` block will autofocus the seeded placeholder on open. Rare in practice; considered acceptable vs. reintroducing the transient-flag complexity.
