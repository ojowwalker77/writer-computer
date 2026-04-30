# Mermaid Diagrams Spec

## Summary

Render ` ```mermaid ` fenced code blocks as inline diagrams, matching the behavior of GitHub Flavored Markdown. The raw fence stays the source of truth; the editor shows a live SVG preview beneath (or in place of) the collapsed block.

## Goals

- Recognize fenced code blocks whose info string is `mermaid` (case-insensitive) and render them as SVG.
- Support the common GFM-compatible diagram types: flowchart, sequence, class, state, ER, gantt, pie, journey, gitGraph, mindmap, timeline.
- Keep the markdown source unchanged — rendering is a decoration, not a transform.
- Fail visibly and locally: a broken diagram shows an inline error with the parser message, not a silent empty block.
- Stay responsive on large documents: diagrams render lazily and do not block typing.

## Non-Goals

- A WYSIWYG diagram editor or drag-to-edit UI.
- Custom Mermaid themes beyond light/dark parity with the editor.
- Exporting diagrams to PNG/PDF as a first-class action (may be added later — see Follow-ups).
- Rendering non-`mermaid` languages graphically (PlantUML, Graphviz, etc.).

## Source Recognition

- Only fenced blocks (` ` ` ```` ` or `~~~`) with the info string starting with `mermaid` qualify. Anything after `mermaid` on the info line (e.g. `mermaid theme=dark`) is ignored for now.
- Indented code blocks and inline code never render as diagrams.
- Detection is driven by the existing Lezer markdown tree used for other block decorations; do not re-scan the document separately.

## Rendering Behavior

- When the cursor is outside the fence, replace the fence with a rendered SVG widget. Clicking the widget places the caret at the start of the fence so the source becomes editable immediately.
- When the cursor is inside the fence (editing mode), show the raw code with syntax highlighting and render the SVG in a small preview strip directly below the fence. This mirrors how tables and HTML blocks already behave in `table-decorations.ts` and `html-block-decorations.ts`.
- Diagrams re-render on a short debounce (~200ms) after edits settle, not on every keystroke.
- The SVG scales to the editor content width; diagrams wider than the viewport get a horizontal scroll container rather than being squashed.

## Parsing And Safety

- Use the `mermaid` npm package, loaded lazily on first diagram render so documents without diagrams pay no cost.
- Pass `securityLevel: "strict"` so user-authored click handlers and inline HTML in labels cannot execute scripts.
- Run the rendered SVG through the same DOMPurify pipeline used in `html-block-decorations.ts`, extended to allow the SVG element set Mermaid emits. Don't bypass sanitization just because the source looks safe.
- Parse errors from Mermaid are caught and shown as a compact inline error block (message + line/column when Mermaid provides it). The raw fence remains visible.

## Theming

- Pick Mermaid's `default` theme in light mode and `dark` in dark mode, driven by the same theme signal the editor already uses.
- Font family and base colors should inherit from editor CSS variables where Mermaid exposes theme variables, so diagrams don't look pasted-in.

## Performance

- Diagrams below the viewport are not rendered until they scroll near it. Use an IntersectionObserver on the decoration's DOM root.
- Cache rendered SVG keyed by `hash(source) + theme`. A re-render is skipped if the cache entry is fresh.
- Mermaid import is dynamic (`import("mermaid")`), so cold documents stay lightweight.
- A single global Mermaid instance is shared across diagrams to avoid per-widget init cost.

## Accessibility

- The SVG gets `role="img"` and an `aria-label` derived from the diagram's title or first line of source.
- Provide a "view source" affordance (keyboard-accessible) that focuses the underlying fence for screen-reader users who can't interact with the SVG.

## Copy / Export

- Copying a selection that spans a rendered diagram copies the fenced source, not the SVG — markdown round-trips must be lossless.
- Right-click on a rendered diagram offers "Copy diagram source" and "Copy SVG" via the existing editor context menu pipeline (`editor-context-menu.ts`).

## Files Expected To Change

- `apps/desktop/src/components/editor-area/use-prosemark-editor.ts` — register the new extension alongside `tableDecorations` and `htmlBlockDecorations`.
- `apps/desktop/src/components/editor-area/mermaid-decorations.ts` (new) — Lezer-driven decoration that replaces/augments `mermaid` fences with a widget.
- `apps/desktop/src/components/editor-area/mermaid-renderer.ts` (new, pure module) — dynamic `mermaid` import, render + cache, sanitize.
- `apps/desktop/src/components/editor-area/editor-context-menu.ts` — add "Copy diagram source" / "Copy SVG" entries when the click target is a diagram widget.
- `apps/desktop/src/components/editor-area/prosemark-theme.css` — error-state and preview-strip styles.
- `apps/desktop/package.json` — add `mermaid` dependency.
- Tests under `apps/desktop/tests/` covering detection, caching, and error rendering (Mermaid itself is mocked to keep tests fast).

## Acceptance Criteria

- A ` ```mermaid ` block containing `graph TD; A-->B;` renders as an SVG flowchart when the caret is elsewhere.
- Placing the caret inside the block reveals the source with highlighting and a live preview below.
- Invalid Mermaid source shows an inline error with the parser message; typing to fix it clears the error without reload.
- Non-`mermaid` fenced code blocks are unaffected.
- Light/dark theme changes re-render the diagram without a page reload.
- Copying a selection containing a rendered diagram yields the original fenced markdown on paste.
- Typing in a document with many diagrams remains smooth (no visible stutter from diagram re-renders).

## Follow-ups (Out Of Scope)

- Export diagram as PNG/SVG file.
- Support for `mermaid` config directives via frontmatter.
- Additional diagram languages (PlantUML, D2, Graphviz).
