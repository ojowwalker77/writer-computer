# Scrollbar Layout Shift Fix Spec

## Summary

Fix the layout shift that happens when the editor content grows tall enough for a scrollbar to appear. Today the editor reflows horizontally as the scrollbar takes up width, which is jarring while typing.

## Goals

- Eliminate horizontal content shift when the scrollbar appears or disappears.
- Keep the scrollbar functional and visible (do not auto-hide it just to dodge the shift).
- Apply the fix uniformly to the editor surface and any other scrollable panes that show the same artifact.

## Approach

- Use `scrollbar-gutter: stable` on the scroll container so the gutter is reserved whether or not a scrollbar is currently rendered.
- Verify behavior with both `overlay` and `classic` scrollbar styles on macOS (and Windows/Linux equivalents).
- For surfaces that need an overlay-style scrollbar, use a custom scrollbar (e.g., a thin always-reserved gutter) rather than relying on browser overlay behavior.

## UX Decisions

- The reserved gutter should be visually inert when no scrollbar is needed (no track, no thumb).
- Do not hide content under the scrollbar; the gutter pads outside the content area.

## Implementation Notes

- Identify every scrollable container in the editor: editor pane, sidebar list, tab strip, command palette results.
- Apply `scrollbar-gutter: stable` to each. For Webkit-on-macOS where this property is partially supported, fall back to a custom-styled scrollbar with reserved width.
- Add a small visual regression test (or manual checklist entry) to catch regressions.

## Files Expected To Change

- `apps/desktop/src/components/editor-area/` styles
- `apps/desktop/src/components/sidebar/` styles
- whichever global stylesheet defines scroll container utilities

## Acceptance Criteria

- Typing past the bottom of the viewport does not shift content horizontally when the scrollbar appears.
- The fix works for the editor body and any other affected scrollable panes.
- No new always-on visible scrollbar where one was not previously rendered.
