# Titlebar Double-Click Zoom Spec

## Summary

Restore the standard macOS behavior where double-clicking the window titlebar zooms (maximizes) or restores the window.

Currently, double-clicking the top bar of the Writer window does nothing, which violates user expectations from every other macOS app.

## Goals

- Match the system "Double-click a window's title bar to" preference (zoom or minimize).
- Work even when the titlebar is custom-decorated by Tauri.
- Do not interfere with double-click selection inside the document title or tab strip.

## Approach

- Tauri v2 windows with a custom titlebar must explicitly listen for double-click events on the drag region and call `window.toggleMaximize()` (or `minimize()`, depending on system pref).
- Read the macOS `AppleActionOnDoubleClick` user default to choose between `Maximize`, `Minimize`, and `None`.
- Bind the handler to the same DOM region that already carries `data-tauri-drag-region`.

## UX Decisions

- Honor `AppleActionOnDoubleClick`. Default to zoom if the value is unreadable.
- Double-clicks on interactive children of the titlebar (tabs, document title, controls) must not bubble up to the zoom handler.
- On Windows and Linux, follow the platform convention (Windows double-click maximizes; Linux usually maximizes too).

## Implementation Notes

- Add a small `useTitlebarDoubleClick` hook that attaches a `dblclick` listener to the drag region, reads the OS preference once at mount, and calls the appropriate window action.
- Read the macOS default through a tiny Tauri command if a JS-only path is not available.
- Tabs and document title should set `data-tauri-drag-region={false}` and stop propagation on dblclick.

## Files Expected To Change

- `apps/desktop/src/components/window-chrome/` or wherever the drag region lives
- `apps/desktop/src/hooks/use-titlebar-double-click.ts` (new)
- `apps/desktop/src-tauri/src/commands/` (small command to read OS pref, if needed)
- `apps/desktop/src-tauri/src/lib.rs`

## Acceptance Criteria

- Double-clicking an empty area of the Writer titlebar zooms the window (or honors the user's macOS preference).
- A second double-click restores the window to its previous size.
- Double-clicking a tab, the document title, or a button on the titlebar does not trigger zoom.
