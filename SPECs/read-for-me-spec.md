# Read For Me

## Goal

Add a read-aloud feature for markdown files. A writer can play the whole current document, or right-click/click within a paragraph and read just that paragraph.

## User Behavior

- Preferences expose ElevenLabs configuration:
  - API key
  - voice ID
  - model ID
- The active markdown editor has a read control for the full document.
- The editor body context menu has a paragraph read action when there is text near the clicked position.
- Writer sends text to ElevenLabs text-to-speech and plays the returned audio.
- Starting another read request stops the previous playback.

## Implementation Notes

- Keep the ElevenLabs HTTP request in Rust IPC so the frontend does not call the remote API directly.
- Use the documented `POST /v1/text-to-speech/:voice_id` endpoint with `output_format=mp3_44100_128`.
- Store configuration through the existing settings schema so defaults and settings UI stay centralized.
- Paragraph detection can use Markdown blank-line boundaries; do not depend on rendered DOM layout.

## Validation

- `vp check`
- `vp test`
- From `apps/desktop/src-tauri/`: `cargo test`, `cargo clippy`, `cargo fmt --check`
