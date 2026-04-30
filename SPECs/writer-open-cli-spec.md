# Writer Open CLI Spec

## Summary

Ship a tiny `writer` shell command that opens a file or folder in the Writer desktop app, the way `code .` launches VS Code.

Typical invocations:

```bash
writer .
writer ~/notes
writer specs/login-flow.md
writer                      # launches Writer with no target
```

This is deliberately a separate, smaller feature from the headless spec-authoring CLI described in [`writer-cli-spec.md`](./writer-cli-spec.md). That spec explicitly defers `writer open` as a future follow-up; this spec is that follow-up, scoped on its own so it can ship without waiting on the larger CLI surface.

## Background

The Tauri app already knows how to open a file or folder passed on the command line:

- `resolve_dropped_path()` in `apps/desktop/src-tauri/src/lib.rs` turns a path into a `PendingOpenPayload` (workspace + optional file), handling both directories and `.md` / `.markdown` files.
- On startup, `std::env::args()` is scanned for a target path and pushed onto the `PendingOpen` queue.
- When a second instance is launched, `tauri-plugin-single-instance` forwards its argv to the running instance, which queues the payload and focuses the window.

So the internal plumbing for "open this path" is already solved. What's missing is a way to invoke it from a shell: on macOS, the app binary lives inside `Writer.app/Contents/MacOS/Writer` and is not on `$PATH`. A plain `open ~/notes` doesn't work either because macOS `open` needs `-a Writer` plus the folder as an argument, and that combination is awkward to type and discover.

## Goals

- Provide a `writer` command that users can run from any shell to open a path in Writer.
- Accept zero or one positional path argument.
- Support directories and markdown files using the same resolution rules as drag-to-icon.
- Launch the app if it is not running; focus the existing window and open the target if it is.
- Keep installation one shell command, and keep uninstallation trivial.
- Stay a single-agent, single-pass change.

## Non-Goals

- No command surface beyond opening a target. Listing, searching, validating, frontmatter editing, and spec templates all belong to [`writer-cli-spec.md`](./writer-cli-spec.md).
- No flags for picking a window, tab, line number, or split in v1.
- No daemon, IPC socket, or HTTP API. The existing `single-instance` argv handoff is enough.
- No Windows or Linux installer work in v1. The launcher should still build on those platforms, but shipping a PATH-ready binary there can follow later.
- No bundling the launcher into the auto-update flow in v1.

## UX

### Invocation

- `writer <path>` — resolves `<path>` relative to the current working directory, then asks the app to open it.
- `writer` (no args) — launches Writer and focuses the existing window if one is running.
- `writer --help` / `-h` — prints a short usage blurb and exits `0`.
- `writer --version` / `-V` — prints the app version and exits `0`.

No other flags in v1.

### Path resolution

The launcher resolves the argument the same way drag-to-icon already does, so behavior stays consistent:

- A directory opens as a workspace.
- A `.md` / `.markdown` file opens its parent as the workspace and the file as the active document.
- Anything else (non-markdown file, missing path, symlink loop, non-UTF-8 bytes) exits non-zero with a clear stderr message and does not launch the app.

Relative paths and `.` / `..` are resolved against `$PWD` before being passed to the app, so `writer .` from inside `~/notes` behaves identically to `writer ~/notes`.

### Exit codes

- `0`: the app was successfully launched or signaled.
- `2`: invalid CLI usage (too many args, unknown flag).
- `3`: the path did not exist, was not a supported type, or the app could not be located or launched.

### Output

- On success, print nothing. The launcher is a one-shot command; success is implied by exit `0`.
- On failure, print a single line to stderr: `writer: <reason>`.

## Approach

### New binary

Add a second Cargo binary target alongside the Tauri app:

```toml
# apps/desktop/src-tauri/Cargo.toml
[[bin]]
name = "writer-cli"
path = "src/bin/writer_cli.rs"
```

The binary is intentionally thin. Its job is to:

1. Parse argv (zero or one positional, plus `--help` / `--version`).
2. Canonicalize the target path if present, using the existing `resolve_dropped_path` rules to decide whether the path is openable.
3. Locate the installed Writer app.
4. Launch it with the canonicalized path as argv, so the existing startup + single-instance code path handles the rest.

Pull `resolve_dropped_path` and friends into a small shared module (e.g. `src/open_target.rs`) that both `lib.rs` and the new binary can import. This avoids duplicating the directory/markdown rules.

### Locating the app

Platform-specific, kept as simple as possible:

- **macOS (primary target)**: use `open -a Writer [path]`. This hands the path to LaunchServices, which finds the installed bundle wherever it lives (`/Applications`, `~/Applications`, DMG). When `open` forwards the path, macOS passes it as argv to the bundle, so the app's existing `std::env::args()` check picks it up on cold start; on warm start, `tauri-plugin-single-instance` forwards it.
- **Linux**: exec the Writer binary from PATH (`Command::new("writer-desktop").arg(path).spawn()`), falling back to a clear error if not found. Acceptable for v1 — most users launch via desktop entries; PATH installation is a later polish.
- **Windows**: same idea — try `writer.exe` on PATH, else a clear error. Packaging can follow later.

If the app cannot be located, exit `3` with a message telling the user to install Writer or set `WRITER_APP_PATH` to point at the bundle/binary.

### Installing `writer` on the user's PATH

Keep installation mechanical and reversible:

- **macOS**: ship a `writer` shim script inside the app bundle at `Writer.app/Contents/Resources/bin/writer`, and add a "Shell Command: Install 'writer' command in PATH" menu item under the app menu that symlinks it into `/usr/local/bin/writer` (prompting for auth via the standard `osascript` admin prompt if needed). A matching "Uninstall" item removes the symlink. This is the same pattern VS Code uses and is well-understood by users.
- **Linux / Windows**: document manual install in the release notes for v1. A packaged installer can add this later.

The shim just exec's the `writer-cli` binary (either from the bundle on macOS or from PATH on Linux/Windows), passing argv through. Keeping the shim dumb means upgrades don't need to rewrite it.

### Argument forwarding

Pass the canonicalized path as the single positional argv to the app. The existing startup and single-instance handlers already handle argv of length > 1, so there is no new frontend or IPC surface.

One small change is needed in `lib.rs`: today, `resolve_dropped_path` silently drops unsupported paths. When the CLI passes a path, the user expects an error on failure. We should move the path validation into the CLI itself (it runs before forking the app) rather than relying on the app to surface a failure. The app side stays as-is: unsupported paths still silently fall through, matching drag-to-icon behavior.

## UX Decisions

- The launcher never opens a file picker or prompts interactively. It is a one-shot shell command.
- The launcher never writes to the workspace, never mutates frontmatter, never reads file contents. It only resolves the path and hands it to the app.
- The launcher does not wait for the app to finish. It exits as soon as `open` / `spawn` returns.
- Non-markdown file targets (e.g. `writer image.png`) are an error, not a silent "open the parent folder." This matches how the app treats drag-drop: unsupported files are ignored. Making the CLI louder here avoids the user staring at an unchanged window.

## Implementation Notes

- Extract `PendingOpenPayload`, `resolve_dropped_path`, and the file extension check into a small `open_target` module so it can be unit-tested and reused by the CLI.
- Use `std::env::args_os()` in the CLI so non-UTF-8 paths produce a clear error rather than panicking.
- Use `std::fs::canonicalize` before extension / metadata checks; refuse paths that do not exist.
- The CLI binary should not link the Tauri runtime. Keep its dependency footprint to `std` + the shared `open_target` module + a minimal arg parser (hand-rolled or `pico-args`; avoid pulling in full `clap` for a two-flag CLI).
- On macOS, prefer `open -a` with the bundle name over hardcoding a path, so moved or multiple-copy installs keep working.
- The install-to-PATH menu item can live behind a simple `writer.install_cli` / `writer.uninstall_cli` Tauri command backed by a small `std::os::unix` symlink helper. Use `osascript -e 'do shell script ... with administrator privileges'` only if the target directory isn't writable.

## Files Expected To Change

- `apps/desktop/src-tauri/Cargo.toml` — new `[[bin]]` target
- `apps/desktop/src-tauri/src/open_target.rs` — extracted path resolution (new)
- `apps/desktop/src-tauri/src/lib.rs` — switch to shared `open_target` module
- `apps/desktop/src-tauri/src/bin/writer_cli.rs` — CLI entrypoint (new)
- `apps/desktop/src-tauri/src/commands/shell_install.rs` — install/uninstall PATH shim (new, macOS only)
- `apps/desktop/src-tauri/src/lib.rs` — register menu items for install/uninstall
- `apps/desktop/src-tauri/tauri.conf.json` — include the `writer` shim and CLI binary as bundle resources
- `docs/` — brief note on CLI usage (optional; CLI `--help` is the primary source of truth)
- `CHANGELOG.md`

## Test Plan

### Unit tests

Against the extracted `open_target` module:

- directory paths resolve to workspace-only payloads
- `.md` and `.markdown` files resolve to workspace-plus-file payloads
- non-markdown files, missing paths, and paths with non-UTF-8 components return `None` / an error
- relative paths canonicalize against the current working directory

### Integration tests

- `writer .` inside a temp directory exits `0` and spawns the expected command (mock the launch step).
- `writer notes/foo.md` produces argv containing the canonical file path.
- `writer notes/image.png` exits `3` with a clear stderr message and does not spawn the app.
- `writer --help` prints usage and exits `0`; `writer --bogus` exits `2`.

### Manual verification

- Run `writer .` from a folder of markdown files: app launches, opens the folder as workspace.
- Run `writer path/to/note.md` while the app is already open: the existing window focuses and the file opens.
- Run `writer` with no args: app launches / focuses with no workspace change.
- Run the "Install 'writer' command in PATH" menu item; confirm `which writer` resolves, then uninstall and confirm it's removed.

## Risk Review

- **PATH install requires admin auth on some systems.** Mitigation: document the fallback (`ln -s "$(mdfind -name Writer.app | head -1)/Contents/Resources/bin/writer" /usr/local/bin/writer`) in the release notes and CLI help.
- **Canonicalization diverges between CLI and drag-drop.** Mitigation: single shared `open_target` module, tested in isolation.
- **Windows/Linux users expecting parity.** Mitigation: call this out explicitly in the CHANGELOG; the CLI still builds and works when launched from a terminal that has `writer-desktop` on PATH, we just don't ship an installer for it in v1.
- **Scope creep toward a full command surface.** Mitigation: defer every non-open command to `writer-cli-spec.md`. If someone wants `writer list`, they can pull that spec into Up Next.

## Acceptance Criteria

- Running `writer .` in a folder of markdown files launches or focuses Writer with that folder as the workspace.
- Running `writer path/to/note.md` launches or focuses Writer with the parent folder as the workspace and the file open.
- Running `writer` with no arguments launches or focuses Writer.
- Invalid paths and unsupported file types exit non-zero with a readable stderr message.
- The launcher is installable and uninstallable from the app menu on macOS without manual filesystem surgery.
- No JSON output, no daemon, no new IPC surface beyond the existing argv handoff.
