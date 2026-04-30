# Auto Update App Spec

## Summary

Add an in-app auto-update mechanism so users on the signed DMG build receive new releases without manually downloading and reinstalling.

This builds on the existing notarized DMG distribution flow added in commits a5b26b6 and b7de678.

The entire user-facing surface for v1 lives in the native app menu and native dialogs — no React/TSX components, no in-editor banner. This keeps the first pass small and avoids coupling release plumbing to frontend layout work.

## Goals

- Detect new published releases and notify the user.
- Download and install updates with user consent.
- Verify update signatures so the channel cannot be hijacked.
- Keep the update flow quiet and non-intrusive when no update is available.
- Keep v1 entirely driven from the native menu and native dialogs.

## Non-Goals

- Forced background updates without user consent.
- Multiple release channels (stable, beta, nightly) in v1.
- Delta updates in v1; full DMG replacement is acceptable.
- Any new React components or in-editor banner UI in v1.

## Approach

- Use the official `tauri-plugin-updater` plugin.
- Host a `latest.json` manifest alongside DMG releases (likely on GitHub Releases).
- Sign releases with a Tauri update key; embed the public key in the app.
- Check for updates on app launch and on user demand from a native menu item.
- All prompts, progress, and results flow through native menu state and native `dialog` plugin calls.

## UX Decisions

- Check for updates at launch and once per day while the app stays open.
- Never auto-restart without user confirmation; users may have unsaved work.
- If the user dismisses an update, do not nag again until the next version.
- All user interaction happens through the native app menu and native dialogs — no custom in-app UI.

### Native menu items

Add a dedicated section under the app menu (e.g., `Writer > ...`):

- `Check for Updates...` — always visible; triggers a manual check and shows a native dialog with the result.
- `Install Update and Restart` — hidden unless an update is ready; triggers download, verify, install, relaunch.
- `Downloading update...` — disabled placeholder shown while a download is in flight (label updates with percent if feasible).

The menu item labels change based on updater state so the user always has a single clear next step.

### Native dialogs

Use `@tauri-apps/plugin-dialog` (or the Rust equivalent) for all prompts:

- Manual check with no update available: info dialog `You're up to date. Writer x.y.z is the latest version.`
- Update available: confirm dialog with `Install and Restart` / `Later` buttons and release notes in the message body.
- Download or install failure: error dialog with the failure reason.
- Post-install readiness: confirm dialog `Update ready. Restart now?` with `Restart` / `Later`.

All automatic (non-user-initiated) checks suppress the "up to date" dialog.

## Updater State Machine

One small state machine owns the updater lifecycle. The native menu rebuilds its items based on state.

States:

- `idle`
- `checking`
- `up-to-date`
- `available { version, notes }`
- `downloading { progress }`
- `ready-to-install { version }`
- `error { message }`

Transitions:

- `idle -> checking` on launch, daily timer, or manual menu click
- `checking -> up-to-date | available | error`
- `available -> downloading` when the user confirms install
- `downloading -> ready-to-install | error`
- `ready-to-install -> (relaunch)` when the user confirms restart

## Implementation Notes

- Keep all updater logic in Rust under `apps/desktop/src-tauri/src/updater.rs`.
- Drive the native menu from Rust too: build and rebuild the menu via `tauri::menu` APIs on state changes.
- Emit Tauri events (`updater://state-changed`) only if some non-menu surface needs them later; v1 does not require them because the menu owns the UI.
- The daily recheck timer lives in Rust (e.g., `tokio::time::interval`) and is cancelled on app exit.
- Store `dismissed_version` in Tauri's store plugin or a small JSON file under app data so the user is not re-prompted for a version they already dismissed.

## Files Expected To Change

- `apps/desktop/src-tauri/Cargo.toml` (add `tauri-plugin-updater`, `tauri-plugin-dialog` if not already present)
- `apps/desktop/src-tauri/src/updater.rs` (new — state machine, menu wiring, check/download/install)
- `apps/desktop/src-tauri/src/lib.rs` (register plugin, install menu, schedule daily check)
- `apps/desktop/src-tauri/tauri.conf.json` (updater public key, endpoints)
- `scripts/distribute.*` or equivalent (publish signed `latest.json` alongside DMG + signature)

Explicitly not changed in v1:

- No new files under `apps/desktop/src/`.
- No `App.tsx` modifications.
- No hooks, components, or stores.

## Acceptance Criteria

- Launching an outdated build surfaces an update prompt through a native dialog.
- `Writer > Check for Updates...` always works and shows a native dialog with the result.
- Choosing `Install and Restart` downloads, verifies, installs, and relaunches the app.
- The native menu reflects updater state (checking, available, downloading, ready, error).
- The update process refuses unsigned or wrongly signed payloads.
- An automatic check with no update available is fully silent.
- No React components or frontend files are introduced by this spec.
