# Worksheet: Read For Me

## Task

TODO: Read for me: ElevenLabs text-to-speech for whole docs and clicked paragraphs (`SPECs/read-for-me-spec.md`).

## Reviewed

- `TODOS.md`
- `docs/workflows/agent-loop.md`
- `docs/react-guidelines.md`
- `docs/zustand.md`
- `docs/codemirror.md`
- `apps/desktop/src/components/editor-area/use-prosemark-editor.ts`
- `apps/desktop/src/components/editor-area/editor-pane.tsx`
- `apps/desktop/src/components/editor-area/editor-context-menu.ts`
- `apps/desktop/src/lib/tauri.ts`
- `apps/desktop/shared/settings.schema.json`
- `apps/desktop/src-tauri/src/lib.rs`
- `apps/desktop/src-tauri/src/commands/mod.rs`
- ElevenLabs official API docs for `POST /v1/text-to-speech/:voice_id`

## Plan

- Add settings schema entries for ElevenLabs API key, voice ID, and model ID.
- Add a Rust `read_aloud` command module using ElevenLabs TTS and return MP3 bytes.
- Add typed Tauri IPC wrapper and a frontend read-aloud API that stops old audio, builds a Blob URL, and plays new audio.
- Add an active-editor read button for the full document.
- Add a context-menu action to read the clicked paragraph using blank-line markdown boundaries.
- Update changelog and TODO when complete.

## Notes

- Plan/implementation review sub-agents are skipped because the active developer instruction only permits spawning agents when the user explicitly asks for delegation.
- Frontend `vp` validation could not run because `vp` is not installed on PATH and `node_modules` is absent in this workspace.
- Rust validation: `cargo fmt --check` passed, `cargo test` passed, and `cargo clippy` completed with existing warnings in unrelated files.

## Implementation

- Added settings schema entries for ElevenLabs API key, voice ID, and model ID.
- Added `commands::read_aloud::text_to_speech`, which validates text/settings, posts to ElevenLabs, and returns MP3 bytes.
- Added a typed Tauri wrapper and `read-aloud-api.ts` playback singleton that stops prior audio before starting another request.
- Added a document-level Read button and a context-menu Read paragraph action.
- Added env fallback for local testing (`ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL_ID`) without storing secrets in tracked files.
- Updated the Read button to read selected text when the editor selection is non-empty.
- Renamed the app/release surface to better-writer and moved updater/release URLs to the fork.
