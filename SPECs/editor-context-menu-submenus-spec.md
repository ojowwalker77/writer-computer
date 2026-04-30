# Editor Context Menu Submenus Spec

## Summary

Extend the editor body's right-click menu (shipped per `SPECs/editor-context-menu-spec.md`) with Obsidian-style **Formatting**, **Paragraph**, and **Insert** submenus so every markdown transformation available via the new formatting keymap is also discoverable through the mouse.

The v1 editor context menu ships with cut/copy/paste/select-all and link actions only. This spec layers the richer formatting actions on top without changing the transport (still native Tauri menu APIs) and without duplicating the command implementations — every submenu item calls into the same editor commands that the formatting keymap binds (see `SPECs/editor-shortcuts-clash-spec.md`).

## Scope

- Editor body (markdown content area) only. Tab and document-title menus are unchanged.
- Markdown source editing only. No rich-text, no WYSIWYG preview toggles.
- Depends on `SPECs/editor-shortcuts-clash-spec.md` landing first so the command implementations exist.

## Goals

- Mirror Obsidian's _Format_ / _Paragraph_ / _Insert_ context menu groupings so users who come from Obsidian feel at home.
- Every submenu item shows the keyboard accelerator next to it, so the menu doubles as in-app shortcut discovery.
- Reuse the exact editor commands behind the shortcut keymap — the menu is a thin alternate trigger, not a second implementation.
- Keep the menu assembly in one shared helper rather than inline at each call site.

## Non-Goals

- Formatting toolbars, hover bubbles, or slash commands — separate tracks.
- Keyboard-driven submenu navigation beyond whatever the native OS menu provides for free.
- Context-aware enable/disable logic beyond what is trivially computable (e.g., disable `Unwrap` style toggles when there is no selection is **not** required — toggles handle the empty-selection case themselves).
- Nested submenus beyond one level deep.

## Current Behavior

`SPECs/editor-context-menu-spec.md` (Done) defines the top-level editor body menu. Per that spec:

- `apps/desktop/src/components/editor-area/index.tsx` registers a `contextmenu` handler that builds a native menu via `@tauri-apps/api/menu`.
- A shared `apps/desktop/src/lib/native-menu.ts` helper is expected to exist (extracted during sidebar or editor context-menu work).
- Link-aware items (`Open link`, `Copy link`) already conditionally appear.

The menu today stops at select-all + link actions and does not surface any markdown transformation.

## Menu Structure

Top-level editor body menu (existing items preserved, three submenus inserted):

1. `Cut`
2. `Copy`
3. `Paste`
4. `Paste as plain text`
5. separator
6. `Format` ▸
7. `Paragraph` ▸
8. `Insert` ▸
9. separator
10. `Select all`
11. separator
12. `Open link` _(only when right-clicking on a link)_
13. `Copy link` _(only when right-clicking on a link)_

### Format submenu

| Item               | Accelerator   | Command                                                                            |
| ------------------ | ------------- | ---------------------------------------------------------------------------------- |
| `Bold`             | `Cmd+B`       | `toggleBold`                                                                       |
| `Italic`           | `Cmd+I`       | `toggleItalic`                                                                     |
| `Strikethrough`    | `Cmd+Shift+X` | `toggleStrikethrough`                                                              |
| `Inline code`      | `Cmd+E`       | `toggleInlineCode`                                                                 |
| separator          | —             | —                                                                                  |
| `Insert link…`     | `Cmd+K`       | `insertLink`                                                                       |
| separator          | —             | —                                                                                  |
| `Clear formatting` | _(none)_      | `clearInlineFormatting` _(strips `**`, `_`, `~~`, `` ` `` wrappers on selection)\* |

### Paragraph submenu

| Item            | Accelerator       | Command                 |
| --------------- | ----------------- | ----------------------- |
| `Heading 1`     | `Cmd+Opt+1`       | `setHeading(1)`         |
| `Heading 2`     | `Cmd+Opt+2`       | `setHeading(2)`         |
| `Heading 3`     | `Cmd+Opt+3`       | `setHeading(3)`         |
| `Heading 4`     | `Cmd+Opt+4`       | `setHeading(4)`         |
| `Heading 5`     | `Cmd+Opt+5`       | `setHeading(5)`         |
| `Heading 6`     | `Cmd+Opt+6`       | `setHeading(6)`         |
| `Paragraph`     | `Cmd+Opt+0`       | `setParagraph`          |
| separator       | —                 | —                       |
| `Bullet list`   | `Cmd+Shift+8`     | `toggleBulletList`      |
| `Numbered list` | `Cmd+Shift+7`     | `toggleNumberedList`    |
| `Task list`     | `Cmd+Shift+Enter` | `toggleTaskList`        |
| separator       | —                 | —                       |
| `Blockquote`    | `Cmd+Shift+.`     | `toggleBlockquote`      |
| `Code block`    | _(none)_          | `toggleFencedCodeBlock` |

### Insert submenu

| Item              | Accelerator | Command                                                                                       |
| ----------------- | ----------- | --------------------------------------------------------------------------------------------- |
| `Link…`           | `Cmd+K`     | `insertLink`                                                                                  |
| `Image…`          | _(none)_    | `insertImage` — opens native file picker scoped to workspace, inserts `![alt](relative-path)` |
| `Table`           | _(none)_    | `insertTable` — inserts a 3×2 skeleton table, caret in first cell                             |
| `Horizontal rule` | _(none)_    | `insertHorizontalRule` — inserts `\n---\n` on its own line                                    |
| separator         | —           | —                                                                                             |
| `Current date`    | _(none)_    | `insertToday` — inserts `YYYY-MM-DD` using local date                                         |
| `Current time`    | _(none)_    | `insertNow` — inserts `HH:mm` using local time                                                |

## Decisions

### All menu items are always enabled

Every formatting command is a toggle that already handles the empty-selection case by operating on the word under the caret. Disabling items based on selection state would introduce flicker during right-click positioning and the saving is not worth the complexity. Items that don't care about selection (`Insert horizontal rule`, `Insert date`) are trivially always-enabled.

### Submenus reuse the same command registry as the keymap

Both surfaces import from `apps/desktop/src/components/editor-area/markdown-formatting.ts` so a bug fix to, e.g., bold toggling is picked up in both places automatically. The menu builder maps menu item IDs to the same `formattingCommands` registry the keymap derives from.

### Accelerators are declarative, not wired

`@tauri-apps/api/menu` lets us set an `accelerator` string on each menu item for display. Setting that string does **not** register the chord — the keymap already does. Setting it only causes the OS to render the shortcut glyph next to the item, which is the discovery value we want.

### `Insert ▸ Image…` uses the workspace-scoped picker

Writer already has image-handling primitives (`commands/images.rs`). The menu action reuses them: prompt via Tauri's file dialog, copy the image into the workspace's asset folder if it lives outside, and insert a markdown image with a workspace-relative path.

### `Table` inserts a static skeleton

No modal, no size picker in v1. Insert a 3-column × 2-row skeleton:

```
| Column 1 | Column 2 | Column 3 |
| --- | --- | --- |
| | | |
```

Caret lands in the first empty body cell.

### No nesting beyond one level

Some Obsidian plugins nest `Paragraph ▸ Heading ▸ H1…H6`. We flatten that to keep menu depth shallow and reduce hover-timing bugs on macOS native menus.

## Implementation Notes

### Menu assembly

Extract menu construction from the editor's `contextmenu` handler into a builder in `apps/desktop/src/components/editor-area/editor-context-menu.ts`:

```ts
export async function buildEditorBodyMenu(ctx: EditorMenuContext): Promise<Menu> {
  return Menu.new({
    items: [
      await standardClipboardItems(ctx),
      separator(),
      await formatSubmenu(ctx),
      await paragraphSubmenu(ctx),
      await insertSubmenu(ctx),
      separator(),
      await selectAllItem(ctx),
      ...(ctx.linkHref ? [separator(), ...linkItems(ctx)] : []),
    ],
  });
}
```

`EditorMenuContext` carries the CodeMirror `EditorView`, the link href under the pointer (if any), and the workspace root (for image inserts).

### Running formatting commands from menu actions

Each menu-item `action` closes over the `EditorView` and calls the same command exported from `markdown-formatting.ts`:

```ts
{ id: "fmt.bold", text: "Bold", accelerator: "CmdOrCtrl+B",
  action: () => runCommand(view, toggleBold) }
```

`runCommand` focuses the view first (menu dismissal may have shifted focus) and then dispatches the command.

### Image insert flow

Prefer reusing whatever the sidebar / drag-drop image insertion already does. If no shared helper exists yet, this spec adds `apps/desktop/src/lib/insert-image.ts` that:

1. Calls `@tauri-apps/plugin-dialog`'s `open({ multiple: false, filters: [image] })`.
2. If the picked path is outside the workspace, copies it to `workspace/attachments/` via an existing Rust command (or adds a minimal `copy_into_workspace` command if none fits).
3. Inserts `![alt](relative-path)` at the caret.

### Focus handling

On macOS, native menus steal focus while open. After the menu closes, if the user chose an action, `runCommand` must call `view.focus()` before dispatching so the resulting transaction sees the editor as focused.

## Files Expected To Change

- `apps/desktop/src/components/editor-area/index.tsx` — call the extracted menu builder.
- `apps/desktop/src/components/editor-area/editor-context-menu.ts` _(new)_ — submenu builders.
- `apps/desktop/src/components/editor-area/markdown-formatting.ts` — add exports (e.g. `clearInlineFormatting`, `toggleFencedCodeBlock`, `setHeading`, `setParagraph`, `toggleTaskList`, `insertTable`, `insertHorizontalRule`, `insertToday`, `insertNow`) if the shortcut spec did not already add all of them.
- `apps/desktop/src/lib/insert-image.ts` _(new, if not already extracted)_ — shared image-insert helper.
- `apps/desktop/src/lib/native-menu.ts` — small additions for submenu + accelerator helpers if needed.
- `apps/desktop/tests/editor-context-menu.test.ts` — submenu structure and action wiring.
- `apps/desktop/src-tauri/src/commands/images.rs` or `fs.rs` — only if a minimal workspace-copy command is needed to back the image insert flow.

## Test Plan

### Component tests

- Right-clicking the editor produces a menu whose top-level items include `Format`, `Paragraph`, `Insert` in that order between the clipboard and `Select all` sections.
- Each submenu contains the items listed above, in the listed order, with the listed accelerator strings.
- Clicking `Format ▸ Bold` calls `toggleBold` with the current editor view.
- Clicking `Paragraph ▸ Heading 2` calls `setHeading(2)`.
- Clicking `Insert ▸ Horizontal rule` inserts `---` on its own line at the caret.
- Clicking `Insert ▸ Current date` inserts `YYYY-MM-DD`.
- Right-clicking on a link still shows `Open link` and `Copy link` at the end of the menu.

### Manual verification

- Verify menu items' accelerators display correctly on macOS (⌘⇧8, ⌘⌥1, etc.).
- Verify `Insert ▸ Image…` opens the native file picker and inserts a workspace-relative path.
- Verify `Insert ▸ Table` lands the caret inside the first empty cell.
- Verify focus returns to the editor after any menu action so subsequent typing lands in the editor, not the menu host.

## Acceptance Criteria

- The editor body right-click menu exposes `Format`, `Paragraph`, and `Insert` submenus populated per the tables above.
- Each submenu item's action runs the same command as the corresponding keyboard shortcut.
- Accelerator strings are displayed next to items that have keyboard bindings.
- Link-context items (`Open link`, `Copy link`) still appear when right-clicking on a link.
- Menu construction lives in a single reusable builder module, not inline in the editor component.

## Risks And Mitigations

- **Command divergence between keymap and menu.** Mitigate by importing commands from a single `markdown-formatting.ts` module; both surfaces are thin wrappers around the same functions.
- **Native submenus have historical flake on macOS** (e.g., hover-reveal timing, Electron-era bugs). Mitigate by keeping submenus one-level deep and using Tauri's supported `Submenu` API without custom timing code.
- **`Insert ▸ Image…` can touch a lot of surface area** (dialog, filesystem, path-rewriting). Mitigate by reusing whatever drag-drop image insertion already relies on, and only building a new helper if none exists.
