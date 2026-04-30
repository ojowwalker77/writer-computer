# Tab Scroll Into View Spec

## Summary

When a file becomes the active tab — whether through user click, sidebar selection, command palette, or keyboard navigation — the tab strip should always scroll the active tab into view.

Today, switching to a tab that is currently scrolled out of the visible tab strip leaves the user with no visual confirmation of what's active.

## Goals

- Always keep the active tab visible in the tab strip after activation.
- Use smooth scrolling for user-driven activations and instant scrolling for restore-on-launch.
- Handle activation triggered from any source uniformly.

## Non-Goals

- Reordering tabs to keep the active tab in a fixed position.
- Auto-scroll on hover or other non-activation events.

## Approach

- Add a `useScrollActiveTabIntoView()` hook that subscribes to active-tab changes and calls `scrollIntoView({ block: 'nearest', inline: 'nearest' })` on the active tab DOM node.
- Subscribe via the editor store to ensure all activation sources go through one path.
- Skip the scroll if the active tab is already fully visible to avoid unnecessary motion.
- Use `behavior: 'auto'` on initial mount, `behavior: 'smooth'` afterwards.

## Implementation Notes

- Tag each rendered tab with a stable `data-tab-id` so the hook can find the right node.
- Run the scroll inside a `useEffect` that depends on the active tab id.
- The first activation after mount must wait until refs are populated; use a microtask deferral if needed.

## Files Expected To Change

- `apps/desktop/src/components/editor-area/editor-tabs.tsx`
- `apps/desktop/src/hooks/use-scroll-active-tab-into-view.ts` (new)
- frontend tests under `apps/desktop/tests/`

## Acceptance Criteria

- Activating a tab from the sidebar always scrolls it into view in the tab strip.
- Activating a tab via keyboard navigation (Cmd+1..9 etc.) always scrolls it into view.
- Activating a tab from the command palette always scrolls it into view.
- No scroll happens when the active tab is already fully visible.
