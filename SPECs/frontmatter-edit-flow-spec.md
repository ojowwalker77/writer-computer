# Frontmatter Edit Flow Spec

## Summary

Model the frontmatter panel as a small state machine over its rows so creating and destroying frontmatter feels right without a transient store flag.

Two row states: **placeholder** (both `key` and `value` are empty) and **committed** (anything else). The UX falls out of two transition rules:

1. **Every placeholder row autofocuses its key input when it mounts.** A seeded empty row on fresh panel mount and a row appended via _Add Property_ are both placeholders, and both get the cursor. React's native `autoFocus` prop carries this — no refs, no effects.
2. **Any row whose key is still empty on blur is removed.** If that removal leaves zero rows, the whole frontmatter block is removed (`updateFrontmatter(path, null)`) and focus returns to the editor.

Together these cover the original user asks:

- Typing `---` creates frontmatter → panel mounts with a seeded placeholder row → its key input autofocuses. Done.
- Deleting the last property (via `×`, Backspace, or just blurring an empty seeded row) empties the entries → `removeFrontmatter()` unmounts the panel. Done.

## Scope

- `frontmatter-panel.tsx` and `use-frontmatter-entries.ts`.
- No store changes. No new domain-hook additions. No changes to `handleFrontmatterStart` beyond what already exists.
- No changes to parsing, save path, or YAML serialization.

## Goals

- Zero-friction frontmatter creation: one `---` gesture drops the user into the first key input with the caret blinking.
- Zero residual state on deletion: removing the last property removes the entire frontmatter block; saving writes markdown without any `---` delimiters.
- Implementation free of render-time store writes, watcher effects, ref-based transition detection, or direct `useEditorStore` imports from co-located hooks.

## Non-Goals

- No new auto-complete, validation, or reserved-key UI.
- No animation / transition polish when the panel mounts or unmounts.
- No handling for pasted frontmatter — that path already runs through `handleFrontmatterPaste` and stays as is.
- No redesign of the `Add property` button; it continues to exist.

## State Machine

Row states:

```
placeholder  ──(user types into key or value)──▶  committed
placeholder  ──(blur with empty key)───────────▶  removed
committed    ──(user clears key)───────────────▶  placeholder
committed    ──(blur with empty key)───────────▶  removed
committed    ──(× or Backspace on empty row)───▶  removed
```

Panel-level:

```
no frontmatter   ──(hasFrontmatter = true)──▶  one placeholder visible
any rows visible ──(rows = 0)───────────────▶  removeFrontmatter() → no frontmatter
```

The hook derives visible rows by parsing the stored YAML and, if the parse yields zero entries while `hasFrontmatter` is true, substituting a single placeholder so the panel never renders empty.

## Behavior

### Creating frontmatter via `---`

`handleFrontmatterStart` in `use-prosemark-editor.ts` detects `---` at line 1 position 2 on a file with no frontmatter, calls `editorApi.updateFrontmatter(path, "")`, and removes the `--` from the editor. That's the entire editor-side change — no signaling beyond setting the frontmatter to `""`.

The panel renders because `hasFrontmatter` is true. `useFrontmatterEntries` sees the empty parse and seeds one placeholder. The placeholder's key input autofocuses via the React `autoFocus` prop. The user starts typing.

### Deleting all properties

Any path that reduces the entry count to zero goes through `commit([])` inside the hook, which calls `removeFrontmatter()` — which resolves to `updateFrontmatter(path, null)`. `hasFrontmatter` flips to false, the panel unmounts, and a `requestAnimationFrame` focuses the active CodeMirror editor.

Paths that hit this:

- `×` button on the last row.
- `Backspace` on an empty row when it is the last row.
- Blurring a row whose key is empty when it is the last row.

## Implementation Sketch

`use-frontmatter-entries.ts`:

```ts
function seedOrParse(frontmatter: string | null): YamlEntry[] {
  if (frontmatter === null) return [];
  const parsed = parseYamlEntries(frontmatter);
  return parsed.length > 0 ? parsed : [{ key: "", value: "", isComplex: false }];
}

// Local entries = external YAML, synced via a single render-time ref check.
// Commit serializes and pushes; empty commit calls removeFrontmatter().
// blurEntry(index) drops the row if its key is empty.
```

`frontmatter-panel.tsx` extracts a `FrontmatterRow` component with:

- `autoFocus={entry.key === "" && entry.value === ""}` on the key input.
- `onBlur` that ignores relatedTargets inside the same row (so Tab from key to value does not trigger cleanup), then calls `blurEntry(index)`.

## Edge Cases

- **File loads with `---\n\n---`.** Panel mounts; seed → one placeholder; `autoFocus` fires. Focus moves to the key input. This is a mild focus-steal on open for an unusual file shape, and is considered acceptable vs. the complexity of distinguishing "just created" from "loaded empty" with a transient flag.
- **User types `---`, then immediately types body text.** The `handleFrontmatterStart` handler has already cleared the `--` from line 1. The placeholder's `autoFocus` fires asynchronously. If a keystroke arrives before the focus settles, it lands in the editor — acceptable.
- **User types a key, then clicks away without tabbing to the value.** Key is non-empty on blur → row kept. Serialized as `{ key: "" }`.
- **User types a value into a row whose key is empty, then blurs.** Key is empty → row removed; the typed value is discarded. A deliberate consequence of the blur rule: a key-less entry has nothing to persist.
- **User adds a property, clicks away without typing.** Empty placeholder row → blur with empty key → row removed. The _Add Property_ action is effectively self-cleaning.
- **Tab between key and value inside a single row.** `relatedTarget` check prevents blur-cleanup when focus stays in the same row.
- **Save is in flight when the last row is deleted.** `updateFrontmatter(path, null)` marks the file dirty and schedules a save. Identical to any other mid-save edit; no special handling.

## Files Changed

- `apps/desktop/src/components/editor-area/use-frontmatter-entries.ts` — replaced with the state-machine hook (seed-or-parse, commit, blurEntry).
- `apps/desktop/src/components/editor-area/frontmatter-panel.tsx` — extracted `FrontmatterRow`, wired `autoFocus` and `onBlur` with relatedTarget check. Dropped the `entries.length > 1` Backspace guard.

No changes to the store, `editor-api.ts`, or the ProseMark editor hook beyond what already existed.

## Acceptance Criteria

- Typing `---` at the start of a document with no frontmatter:
  - Mounts the panel with a single row.
  - Focuses that row's key input; keystrokes land in it.
- Pressing Enter on the last row's value input:
  - Appends a placeholder row and focuses it (via the autoFocus-on-mount rule).
- Deleting the last row via any mechanism (`×`, Backspace, blur with empty key):
  - Removes the frontmatter block from state (`frontmatter` becomes `null`).
  - Unmounts the frontmatter panel.
  - Returns focus to the active CodeMirror editor.
- Opening a file that has pre-existing non-empty frontmatter:
  - Does **not** steal focus.
- `vp check` and `vp test` pass.

## Follow-ups (Out Of Scope)

- Keyboard shortcut for _Add property_.
- Inline YAML key validation (no whitespace, no duplicates).
- Drag-to-reorder rows.
- Tightening the editor-refocus selector to avoid first-in-DOM fallback in multi-pane layouts.
