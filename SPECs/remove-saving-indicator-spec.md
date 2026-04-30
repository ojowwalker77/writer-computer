# Remove Saving Indicator Spec

## Summary

Remove the visible "saving" indicator from the editor chrome **and** the dirty dot from tab titles. Saves happen quickly enough and frequently enough that neither signal conveys useful information; on a content-focused writing surface they pull attention away from the document.

## Goals

- Strip the saving indicator from the editor chrome.
- Remove the dirty dot from tab titles so tabs stay visually calm.
- Keep the underlying autosave and dirty-tracking behavior unchanged.
- Preserve a clear failure surface for the rare case where a save errors out.

## Non-Goals

- Changing autosave timing or debounce behavior.
- Removing dirty tracking itself from the editor store — only its visual surface on tabs goes away.
- Building a new notification surface for save activity.

## UX Decisions

- Both indicators simply disappear. No replacement on the tab.
- Save errors must still surface explicitly — through a non-blocking toast or an error state on the affected tab — so silent failures cannot hide.
- The window-modified dot in the title bar (macOS) remains the canonical "unsaved" hint at the window level.
- The tab close affordance stays in its normal place; it does not need to gain extra affordance to compensate for the missing dirty dot.

## Implementation Notes

- Locate the existing saving indicator component and remove it from its parent.
- Remove the dirty-dot rendering from the tab component, but keep `isDirty` (or equivalent) in the editor store since close-confirmation flows and the macOS window-modified dot still depend on it.
- Audit any state subscriptions that existed only to drive the removed visuals and remove them too — do not leave dead store fields or selectors behind.
- Preserve `saveStatus` or its equivalent only if it is still consumed by error handling.

## Files Expected To Change

- `apps/desktop/src/components/editor-area/` (whichever component renders the chrome indicator)
- `apps/desktop/src/components/editor-area/editor-tabs.tsx` (remove the dirty dot rendering)
- `apps/desktop/src/stores/editor-store.ts` (only if save-status state can be simplified; do not remove `isDirty`)
- frontend tests under `apps/desktop/tests/`

## Acceptance Criteria

- The saving indicator is no longer rendered anywhere in the editor chrome.
- Tab titles no longer show a dirty dot or any other unsaved-state glyph.
- Autosave still runs on the same cadence.
- Dirty tracking still powers the close-confirmation flow and the macOS window-modified dot.
- Save failures still surface visibly to the user.
- No dead state or selectors remain after removal.
