# Hide Sidebar Handle Spec

## Summary

Hide the visible vertical handle/divider between the sidebar and editor area in its idle state. The handle adds visual weight without earning its real estate; users rarely resize the sidebar and the constant line distracts from content.

## Goals

- Remove the always-visible divider between sidebar and editor.
- Keep resize functionality intact via an invisible hit area.
- Optionally show the handle on hover for discoverability.

## Non-Goals

- Removing the sidebar collapse/expand affordance.
- Replacing the resize behavior with a different interaction model.

## UX Decisions

- Default state: no visible divider line. The sidebar background and editor background can carry the boundary instead.
- Hover state: a 1px-wide subtle divider appears when the cursor is within ~8px of the boundary, plus the resize cursor.
- Active drag state: the divider becomes more prominent (matches the existing drag affordance).
- Keyboard focus: when the resize handle is focused via keyboard, it must remain visible for the focus duration.

## Implementation Notes

- Keep the resize hit area at its current width (or widen it slightly) so the interaction remains comfortable.
- Drive visibility with CSS `:hover`/`:active`/`:focus-visible` rather than React state where possible.
- Verify the handle is still accessible to screen readers and keyboard users (with an `aria-label` and an arrow-key resize binding if one exists).

## Files Expected To Change

- `apps/desktop/src/components/sidebar/` (resize handle component and styles)
- relevant global stylesheet variables for the divider color

## Acceptance Criteria

- The vertical handle between sidebar and editor is invisible in the idle state.
- Hovering near the boundary reveals a subtle divider and the resize cursor.
- Drag-resizing still works as before.
- The handle remains discoverable to keyboard and assistive-tool users.
