# Editor Search Lifecycle Refactor

## Goal

Make the custom editor search overlay own CodeMirror search lifecycle explicitly, without component effects that mirror React state into editor state after render.

## Requirements

- Closing search must close both the React overlay and CodeMirror's hidden search panel.
- Closing or destroying a tab must not leave a stale `EditorView` in global state.
- Search query and replace text changes should update CodeMirror from event-level handlers, not from a `useEffect` watcher.
- Match counter updates should bail out when the overlay is closed or when updates come from another editor view.
- The shipped search mode is literal, case-insensitive search.

## Validation

- `vp check`
- Manual smoke: Cmd+F opens, typing highlights/counts, Enter navigates, Esc closes and clears highlights, tab switch/close does not leave stale highlights.
