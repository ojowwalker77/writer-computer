# Editor Shortcuts Clash + Formatting Keymap Spec

## Summary

Fix the two confirmed keyboard-shortcut clashes between Writer's global app shortcuts and the editor's selection / formatting needs, and introduce a first-class markdown formatting keymap modeled on Obsidian defaults.

The two clashes today:

1. **`Alt+Shift+ArrowLeft` / `Alt+Shift+ArrowRight`** — the global tab-history navigation handler intercepts these before CodeMirror sees them, so word-wise selection extension inside the editor is broken.
2. **`Cmd+B`** — bound globally to _Toggle Sidebar_, preventing the much more valuable markdown _bold_ binding inside the editor.

While fixing these we also ship the missing formatting keymap (`Cmd+B` bold, `Cmd+I` italic, `Cmd+K` link, etc.) and a canonical shortcut map at `docs/keyboard-shortcuts.md`.

## Goals

- Preserve native word-wise selection inside the editor (`Alt+Shift+Arrow`).
- Free `Cmd+B` for bold and keep a discoverable sidebar-toggle binding.
- Add markdown formatting shortcuts that match user expectations set by Obsidian / Apple Notes / Bear.
- Keep **all** global shortcuts and editor formatting bindings in explicit, reviewable registries.
- Document the canonical map in one place so future shortcut additions can be sanity-checked against it.

## Non-Goals

- User-customizable keybindings (a broader "hotkeys" preferences surface stays out of scope for v1).
- Command-palette-driven invocation of formatting commands (can follow once the bindings exist).
- Reworking CodeMirror's default editor keymaps beyond the minimum needed for the formatting layer.
- Shipping a full WYSIWYG formatting toolbar; that's a separate UX track.

## Current Behavior

### Global shortcut handler

`apps/desktop/src/hooks/use-keyboard-shortcuts.ts` registers a single `window` `keydown` listener that intercepts shortcuts before they reach the editor:

- `use-keyboard-shortcuts.ts:25-29` — `Alt+ArrowLeft` → `navigateBack()`. **Bug:** does not check `e.shiftKey`, so `Alt+Shift+ArrowLeft` (the macOS word-select-left gesture) is swallowed.
- `use-keyboard-shortcuts.ts:31-35` — `Alt+ArrowRight` → `navigateForward()`. Same bug as above.
- `use-keyboard-shortcuts.ts:52-56` — `Cmd/Ctrl+B` → `toggleSidebar()`. No second binding path reaches the editor.
- `use-keyboard-shortcuts.ts:66-70` — `Cmd/Ctrl+\` → `toggleSidebar()` (already an alternate binding for the same action).

### Editor

`apps/desktop/src/components/editor-area/use-prosemark-editor.ts:313-378` composes the CodeMirror state using `prosemarkBasicSetup()` from `@prosemark/core@0.0.5`, which bundles `defaultKeymap`, `historyKeymap`, `searchKeymap`, `closeBracketsKeymap`, `completionKeymap`, `foldKeymap`, `lintKeymap`. There are **no** markdown formatting bindings today — no `Cmd+B`, no `Cmd+I`, no `Cmd+K`.

Default keymap details relevant here: `Alt+ArrowLeft`/`Alt+ArrowRight` map to `cursorSyntaxLeft` / `cursorSyntaxRight`, and with `Shift` they extend the selection. Those bindings are correct — they just never run because the global listener calls `preventDefault()` first.

### Docs

No `docs/keyboard-shortcuts.md` exists. The accessibility spec (`SPECs/keyboard-and-accessibility-spec.md`, shipped) called for one but left authoring it to a follow-up.

## Obsidian Reference

Obsidian's default bindings form the baseline expectation for most markdown-first users. The ones Writer should align with:

| Action                 | Obsidian              | Notes                                                                   |
| ---------------------- | --------------------- | ----------------------------------------------------------------------- |
| Bold                   | `Cmd+B`               | Wraps selection in `**…**`                                              |
| Italic                 | `Cmd+I`               | Wraps selection in `*…*`                                                |
| Insert link            | `Cmd+K`               | Wraps selection as `[text](url)` with cursor in URL slot                |
| Toggle inline code     | `Cmd+E`               | (Obsidian uses `Cmd+E` for edit/preview; we repurpose — see decisions.) |
| Toggle comment         | `Cmd+/`               | Inherited from CodeMirror default                                       |
| Heading levels 1–6     | `Cmd+Opt+1…6`         | Avoids the Cmd+1–9 tab-switch clash                                     |
| Indent list            | `Tab` / `Cmd+]`       | Inherited from CodeMirror default                                       |
| Outdent list           | `Shift+Tab` / `Cmd+[` | Inherited from CodeMirror default                                       |
| Toggle bullet list     | `Cmd+Shift+8`         | Mirrors Apple Notes / Bear                                              |
| Toggle numbered list   | `Cmd+Shift+7`         | Mirrors Apple Notes / Bear                                              |
| Toggle task / checkbox | `Cmd+Shift+Enter`     |                                                                         |
| Toggle blockquote      | `Cmd+Shift+.`         | Obsidian uses this for blockquote via community plugins; we adopt       |
| Open command palette   | `Cmd+P`               | Already bound in Writer                                                 |
| Quick switcher         | `Cmd+O`               | Already bound in Writer                                                 |

Obsidian does not bind `Cmd+B` to sidebar-toggle; its sidebar toggles are `Cmd+Opt+Left` / `Cmd+Opt+Right` (not applicable here since Writer has one sidebar). Writer already has `Cmd+\` as a second sidebar binding we can keep as the primary.

## Decisions

### Alt+Shift+Arrow → pass through to editor

Scope the global back/forward handler to the no-shift case. `Alt+Shift+ArrowLeft/Right` should be allowed to bubble to CodeMirror so native word-wise selection extension works. `Alt+Arrow` (no shift) remains a global history navigation binding.

This is the minimum-correct fix. We do not repurpose the plain-Alt bindings in this spec — they are useful and not reported as broken.

### Cmd+B → bold, Cmd+\ → sidebar

- `Cmd+B` is removed from the global handler.
- `Cmd+B` is registered at high precedence in the editor's CodeMirror keymap, bound to _toggle bold_ on the current selection (or the word under the caret if empty).
- `Cmd+\` is promoted to the canonical sidebar toggle and announced in the sidebar tooltip.
- **Outside the editor** (e.g., sidebar focused, command palette closed), `Cmd+B` is a no-op rather than toggling the sidebar. This is deliberate: silently doing different things based on focus is worse than having one obvious binding. If we want a second sidebar accelerator we can add `Cmd+Shift+E` later; out of scope here.

### Formatting keymap lives in the editor, not the global hook

The new formatting bindings must be registered as CodeMirror keymap entries with `Prec.high` so they win over `defaultKeymap` entries that share a chord (e.g., `Cmd+I` currently binds to `selectParentSyntax` in `defaultKeymap`; we override).

Registering these globally would defeat the purpose — they must only fire when the editor has focus, otherwise `Cmd+B` inside, say, the settings panel would wrap selected UI text.

### Heading shortcuts use `Cmd+Opt+N`

`Cmd+1..9` is already tab-switching in Writer (`use-keyboard-shortcuts.ts:105-112`) and we don't want to break that. `Cmd+Opt+1..6` is a safe and conventional fallback for heading levels.

### `Cmd+E` is currently free — use it for inline code

Obsidian's `Cmd+E` (toggle edit/preview) has no analogue in Writer since we are source-only. Reclaim it for toggle-inline-code so the formatting shortcut footprint stays compact. Document the conscious divergence.

### Canonical shortcut doc

All app-level and editor-level shortcuts land in `docs/keyboard-shortcuts.md`, grouped by surface (Global, Editor, Sidebar). Referenced from `CLAUDE.md`.

## Architecture

Two trigger surfaces, one division by scope:

- **React global hook** (`apps/desktop/src/hooks/use-keyboard-shortcuts.ts`) stays as the owner of all app-wide chords (tabs, sidebar, palette, settings, history). These must fire regardless of focus, so a CodeMirror extension cannot own them. This spec edits three branches of this hook; everything else stays put.
- **CodeMirror extension** (new: `apps/desktop/src/components/editor-area/markdown-formatting.ts`) owns every formatting chord. These must **only** fire when the editor is focused — wrapping sidebar text with `**` on `Cmd+B` would be a bug. The extension is imported once by `use-prosemark-editor.ts` and added to the state's extensions list.

`Cmd+B` is the only chord that moves between surfaces — removed from the global hook, added to the extension.

### Extension shape

Export the extension as a plain `Extension` value, not a factory:

```ts
// apps/desktop/src/components/editor-area/markdown-formatting.ts
import { keymap } from "@codemirror/view";
import { Prec, type Extension } from "@codemirror/state";

export const markdownFormatting: Extension = [Prec.high(keymap.of(formattingKeymap))];
```

The CM6 guide recommends a factory-even-without-params pattern to preserve API room for future config. We reject that here — there is no configuration on the roadmap, and the guardrails forbid designing for hypothetical requirements. If config is ever needed, converting a `const` to a function is a one-line refactor.

### Commands as `StateCommand`

Every formatting command is a `StateCommand` (`({state, dispatch}) => boolean`) rather than a `Command` (`(view) => boolean`). `StateCommand` is pure state-in / transaction-out, which makes each command unit-testable against an in-memory `EditorState` without a DOM or a live `EditorView`. None of our commands need the `view` handle.

Each command:

1. Computes changes via `state.changeByRange(range => ...)` so multi-cursor selections work naturally.
2. Dispatches **one** transaction per invocation with `userEvent: "input.format.<name>"` so adjacent formatting gestures merge correctly in the undo history.
3. Returns `true` if it mutated, `false` otherwise, so CodeMirror falls through to other keymaps correctly.

### Detection: syntax tree, not `sliceDoc`

The common "cursor inside a bold run, hit `Cmd+B` to unbold" gesture breaks if we detect formatting by peeking 2 characters around the selection (`sliceDoc(from-2, from) === "**"`). The cursor is inside the word, so the peek returns letters, not markers, and we wrongly wrap the empty position in new `**…**`.

The correct detection uses the markdown syntax tree:

```ts
import { syntaxTree } from "@codemirror/language";

function findEnclosing(state: EditorState, pos: number, name: string) {
  let node = syntaxTree(state).resolveInner(pos, -1);
  while (node && node.name !== name) node = node.parent ?? null;
  return node?.name === name ? node : null;
}
```

For bold: if `findEnclosing(state, range.from, "StrongEmphasis")` returns a node, unwrap using its `from`/`to`; otherwise wrap. Applies analogously to `Emphasis` (italic), `InlineCode`, `Strikethrough`, and `Link`.

### Preflight: markdown syntax tree must be active

Syntax-tree detection relies on `@codemirror/lang-markdown` being installed as an active extension — otherwise `syntaxTree(state)` returns a fallback tree with no `StrongEmphasis` / `Emphasis` nodes and detection silently reports "nothing is ever bold."

Before implementing, verify that `prosemarkBasicSetup()` from `@prosemark/core@0.0.5` includes `markdown()` in its extension list. A quick runtime assertion is enough: build an `EditorState` with `prosemarkBasicSetup()`, set the doc to `**hello**`, and confirm `syntaxTree(state)` exposes a `StrongEmphasis` node. If it does not, add `markdown()` explicitly in `use-prosemark-editor.ts` before the formatting extension. Do **not** ship the formatting commands without this check — silent degradation violates _"fail explicitly."_

### Command + chord co-location

Both the keymap and the context-menu spec (`SPECs/editor-context-menu-submenus-spec.md`) need `(run, chord)` pairs — the keymap to bind them, the menu to display the accelerator glyph. Keep them co-located in one registry inside `markdown-formatting.ts`:

```ts
const formattingCommands = {
  "format.bold": { run: toggleBold, chord: "Mod-b" },
  "format.italic": { run: toggleItalic, chord: "Mod-i" },
  "format.link": { run: insertLink, chord: "Mod-k" },
  // …
} as const;

const formattingKeymap: KeyBinding[] = Object.values(formattingCommands).map((c) => ({
  key: c.chord,
  run: c.run,
}));
```

One source of truth, two consumers. This is **not** predesigning for a command palette — it is justified solely by the keymap + context-menu pair already in scope. If the context-menu spec is cut, the registry collapses to a plain array and the `chord` field moves inline into the keymap.

### Module layout

Everything above lives in a single file until it earns a split:

```
apps/desktop/src/components/editor-area/
  markdown-formatting.ts   ← registry + commands + keymap + exported Extension
```

Resist pre-splitting into `commands.ts` / `keymap.ts` / `syntax-tree-utils.ts` as a reflex. If the file grows past ~600 LOC or `findEnclosing` earns a second caller, split then.

### Tradeoff acknowledgment

We accept one extra dependency surface (active markdown parser) and a tree-walk per formatting keypress in exchange for correct toggle behavior on the most common user gesture (cursor inside an existing formatted run). The alternative — detect via `sliceDoc` — fails that case silently, which violates _"fail explicitly"_ in the guardrails. The tree-walk cost is bounded (tree traversal is O(log n) in document depth) and only runs on keypress, never on render.

## Proposed Shortcut Map

### Global (fires regardless of focus)

| Chord                         | Action                        | Source file                 |
| ----------------------------- | ----------------------------- | --------------------------- |
| `Cmd+,`                       | Open Settings                 | `use-keyboard-shortcuts.ts` |
| `Cmd+P` / `Cmd+Shift+P`       | Command palette / file search | `use-keyboard-shortcuts.ts` |
| `Cmd+O`                       | Quick file switcher           | `use-keyboard-shortcuts.ts` |
| `Cmd+N`                       | New note                      | `use-keyboard-shortcuts.ts` |
| `Cmd+T`                       | New tab                       | `use-keyboard-shortcuts.ts` |
| `Cmd+W`                       | Close active tab              | `use-keyboard-shortcuts.ts` |
| `Cmd+\`                       | Toggle sidebar _(canonical)_  | `use-keyboard-shortcuts.ts` |
| `Cmd+1..9`                    | Jump to Nth tab               | `use-keyboard-shortcuts.ts` |
| `Ctrl+Tab` / `Ctrl+Shift+Tab` | Cycle tabs                    | `use-keyboard-shortcuts.ts` |
| `Alt+ArrowLeft` _(no shift)_  | Navigate back                 | `use-keyboard-shortcuts.ts` |
| `Alt+ArrowRight` _(no shift)_ | Navigate forward              | `use-keyboard-shortcuts.ts` |

Removed from global: `Cmd+B`.

### Editor formatting (new, via CodeMirror `Prec.high` keymap)

| Chord                     | Action                    | Markdown behavior                                |
| ------------------------- | ------------------------- | ------------------------------------------------ | ------------------------- |
| `Cmd+B`                   | Toggle bold               | `**word**`                                       |
| `Cmd+I`                   | Toggle italic             | `*word*`                                         |
| `Cmd+K`                   | Insert link               | `[selection](                                    | )` with caret in URL slot |
| `Cmd+E`                   | Toggle inline code        | `` `word` ``                                     |
| `Cmd+Shift+X`             | Toggle strikethrough      | `~~word~~`                                       |
| `Cmd+Shift+7`             | Toggle numbered list      | Prefix current block with `1. `                  |
| `Cmd+Shift+8`             | Toggle bullet list        | Prefix current block with `- `                   |
| `Cmd+Shift+.`             | Toggle blockquote         | Prefix current block with `> `                   |
| `Cmd+Shift+Enter`         | Toggle task item          | Prefix current block with `- [ ] ` / `- [x]`     |
| `Cmd+Opt+1` … `Cmd+Opt+6` | Heading level 1–6         | Prefix current block with `# ` through `###### ` |
| `Cmd+Opt+0`               | Clear heading (paragraph) | Strip `#+ ` prefix                               |

Editor defaults inherited unchanged from CodeMirror: `Cmd+/` toggle comment, `Cmd+[` / `Cmd+]` indent/outdent, `Cmd+D` select next occurrence, `Cmd+F` find, `Cmd+Z` / `Cmd+Shift+Z` undo/redo, `Alt+ArrowUp/Down` move line, `Cmd+Enter` insert blank line, `Escape` simplify selection, `Alt+Arrow` / `Alt+Shift+Arrow` word-wise cursor and selection.

### Sidebar-focused (unchanged by this spec)

- `Escape` clears sidebar selection (`file-tree.tsx:86`).

## Implementation Notes

### Scope the global Alt+Arrow handler

```ts
if (e.altKey && !e.shiftKey && e.key === "ArrowLeft") { … }
if (e.altKey && !e.shiftKey && e.key === "ArrowRight") { … }
```

Do not introduce a separate "editor focused?" check — the `!e.shiftKey` gate is the correct semantic fix regardless of focus and avoids coupling the global hook to editor DOM state.

### Remove global Cmd+B; keep Cmd+\

Delete the `mod && e.key === "b"` branch in `use-keyboard-shortcuts.ts`. The tooltip on the sidebar toggle button should now read `Cmd+\` (platform-adjusted). Search the codebase for any UI that still advertises `Cmd+B` for sidebar and update.

### Wire the extension into the editor

In `use-prosemark-editor.ts`, import the extension and add it to the `EditorState` config alongside `prosemarkBasicSetup()`. Order does not matter for correctness — `Prec.high` inside the extension pins its keymap above `defaultKeymap` regardless of array position — but conventionally append it after the basic setup so the extension list reads top-down from generic to specific.

```ts
import { markdownFormatting } from "./markdown-formatting";

extensions: [prosemarkBasicSetup(), markdownFormatting /* … */];
```

### Formatting command behavior

Commands are defined per the Architecture section. Behavior summary per command family:

- **Inline wrappers** (bold, italic, code, strikethrough): use `findEnclosing` against the relevant markdown node type. If enclosed, unwrap using the node's `from`/`to`. Otherwise, wrap the current selection — or, if the selection is empty, wrap the word under the caret (fall back to inserting an empty delimiter pair with caret between if there is no word).
- **Link**: if the caret is inside an existing `Link` node, place the caret in that node's URL slot. If the selection is non-empty, wrap as `[selection](|)` with caret at `|`. If empty, insert `[](|)` with caret at `|`.
- **Block-prefix** (heading, list, blockquote, task): walk each line covered by the current selection. If **every** target line already carries the prefix, strip it; otherwise apply. Normalize headings — replace an existing `#+ ` prefix rather than stacking.

All commands annotate their transaction with `userEvent: "input.format.<name>"` and return `true` on mutation, `false` otherwise.

### Tests

Because commands are `StateCommand`s, the test surface is pure: build an `EditorState` in memory, invoke the command, assert on `newState.doc.toString()` and `newState.selection`. No DOM, no `EditorView`.

```ts
// apps/desktop/tests/editor-formatting.test.ts
function run(cmd: StateCommand, doc: string, selection: SelectionRange): EditorState {
  const state = EditorState.create({
    doc,
    extensions: [markdown()],
    selection: EditorSelection.create([selection]),
  });
  let next = state;
  cmd({
    state,
    dispatch: (tr) => {
      next = tr.state;
    },
  });
  return next;
}
```

Cover these cases per command:

- Empty selection on a bare word → wraps the word.
- Empty selection inside an existing run → unwraps the entire run (regression case for the sliceDoc approach).
- Non-empty selection exactly matching a wrapped run → unwraps.
- Multi-cursor selection → each cursor toggles independently.
- Multi-line selection (block commands) → each line toggled; mixed input applies to all.
- Heading toggle over a line that is already `## ` → replaces to the requested level, does not become `#### `.
- Link command with empty selection lands the caret in the URL slot.
- Link command with a caret inside an existing `Link` lands the caret in that link's URL slot without mutating.

Also cover the preflight: assert that the extension set actually exposes `StrongEmphasis` / `Emphasis` / `InlineCode` / `Link` nodes for a representative doc. This test fails loudly if an upstream change drops `@codemirror/lang-markdown`.

Integration-test the global-hook fix separately:

- `Alt+Shift+ArrowLeft` dispatched to the window while the editor is focused extends the selection one word left rather than triggering `navigateBack`.
- `Cmd+B` while the editor is focused toggles bold and does **not** toggle the sidebar.
- `Cmd+\` still toggles the sidebar.

## Files Expected To Change

- `apps/desktop/src/hooks/use-keyboard-shortcuts.ts` — scope Alt+Arrow with `!e.shiftKey`, drop the `Cmd+B` branch.
- `apps/desktop/src/components/editor-area/use-prosemark-editor.ts` — import and include the new extension; add explicit `markdown()` here only if the preflight shows `prosemarkBasicSetup()` does not already bundle it.
- `apps/desktop/src/components/editor-area/markdown-formatting.ts` _(new)_ — registry + `StateCommand` implementations + derived keymap + exported `Extension`.
- UI tooltips that previously advertised `Cmd+B` for sidebar (sidebar toggle button).
- `docs/keyboard-shortcuts.md` _(new)_ — canonical map.
- `CLAUDE.md` — add a pointer to the new doc under the Index.
- `apps/desktop/tests/editor-formatting.test.ts` _(new)_ — `StateCommand` unit tests.
- `apps/desktop/tests/` — global-hook regression tests for Alt+Shift+Arrow and Cmd+B routing.

## Acceptance Criteria

- With the editor focused, `Alt+Shift+ArrowLeft` and `Alt+Shift+ArrowRight` extend the selection by word and **do not** navigate tab history.
- With the editor focused, `Cmd+B` toggles bold on the current selection (or word).
- `Cmd+\` toggles the sidebar, and the sidebar-toggle UI advertises `Cmd+\` rather than `Cmd+B`.
- `Cmd+I`, `Cmd+K`, `Cmd+E`, `Cmd+Shift+X`, `Cmd+Shift+7`, `Cmd+Shift+8`, `Cmd+Shift+.`, `Cmd+Shift+Enter`, and `Cmd+Opt+{0..6}` behave per the proposed shortcut map.
- Formatting commands are no-ops when the editor is not focused.
- `docs/keyboard-shortcuts.md` lists every global and editor binding and is linked from `CLAUDE.md`.

## Risks And Mitigations

- **Future `@prosemark/core` upgrades may re-order keymap precedence.** Mitigate by pinning to a known-good version and covering the key shared chords (`Cmd+I`, `Cmd+B`, `Cmd+K`) with integration tests that assert Writer's formatting command wins.
- **Heading/list toggle semantics are easy to get subtly wrong on multi-line selections.** Mitigate with explicit unit-test cases for each toggle path (apply, strip, mixed).
- **Users who had internalized `Cmd+B` as sidebar.** Mitigate with a one-line release note and by keeping `Cmd+\` as a stable alternative that already existed.
