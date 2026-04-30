# Extensionless Markdown Links Spec

## Summary

Resolve workspace-internal markdown links that omit the `.md` extension, including trailing-slash paths common in imported docs (Hugo, Docusaurus, Kubernetes, MDN, Astro). Today, a link like `[Dynamic Admission Control](/docs/reference/access-authn-authz/extensible-admission-controllers/)` is classified as `external-path` in `resolveLinkTarget` because its extension is neither `md` nor `markdown`, so clicking it fails to open the intended note.

## Problem

`apps/desktop/src/lib/paths.ts:80` only marks a resolved path as `internal` when the extension is `md`/`markdown`. Real-world markdown corpora routinely use extensionless URLs:

- `/docs/foo/bar/` — trailing slash, intended to map to `foo/bar.md` or `foo/bar/index.md`
- `/docs/foo/bar` — no slash, no extension
- `./sibling` — relative, no extension

All of these should open the corresponding workspace file when one exists.

## Goals

- Resolve an extensionless link to a workspace markdown file when an unambiguous candidate exists.
- Preserve current `.md` / `.markdown` behavior exactly.
- Preserve fragment (`#heading`) and query parts when handing off to the existing navigation pipeline so the heading-anchor spec composes cleanly.
- Fail predictably: if no candidate file exists, classify as `external-path` (today's fallback) rather than silently navigating to the wrong file.

## Non-Goals

- Auto-creating missing target files.
- Any new UI for ambiguous resolution — pick deterministically, do not prompt.
- Rewriting links on save to add `.md`.
- External-URL handling (`https://example.com/docs/foo/`) — these remain `external-url`.

## Resolution Rules

Given a resolved, workspace-relative path `P` with no recognized markdown extension:

1. Strip a single trailing `/` from `P`.
2. Try candidates in order and pick the first that exists in the file index:
   1. `P.md`
   2. `P.markdown`
   3. `P/index.md`
   4. `P/index.markdown`
   5. `P/README.md`
3. If none exist, return `external-path` as today.
4. Candidates must lie inside the workspace root; otherwise return `external-path`.
5. Non-markdown extensions (e.g. `.png`, `.pdf`) keep their current behavior — no candidate probing.

Resolution is synchronous and uses the existing in-memory workspace file index, not disk I/O.

## Fragment And Query Handling

`splitLinkHref` already separates the path from `#fragment`/`?query`. The candidate probe runs against the path component only; the original fragment/query is re-attached to the resolved path before returning, so heading-anchor and future query-param features see an unchanged href shape.

## Ambiguity

The ordered list above is the tiebreaker — first hit wins, deterministically. If a workspace contains both `foo.md` and `foo/index.md`, `foo.md` wins. This matches Hugo/Docusaurus conventions and avoids a prompt.

## Files Expected To Change

- `apps/desktop/src/lib/paths.ts` — extend `resolveLinkTarget` with the candidate probe; inject the file-index lookup as a parameter so the function stays pure and testable.
- `apps/desktop/src/components/editor-area/use-prosemark-editor.ts` — pass the current file-index lookup into `resolveLinkTarget` at the call site.
- `apps/desktop/tests/` — unit tests for each candidate rule, trailing-slash handling, fragment preservation, workspace-boundary enforcement, non-markdown extensions, and the no-match fallback.

## Acceptance Criteria

- `[X](/docs/foo/bar/)` opens `docs/foo/bar.md` when present.
- `[X](/docs/foo/bar/)` opens `docs/foo/bar/index.md` when `bar.md` is absent but `bar/index.md` exists.
- `[X](./sibling)` opens `sibling.md` relative to the current file.
- `[X](./sibling#heading)` opens `sibling.md` and preserves `#heading` for the anchor pipeline.
- `[X](/outside/workspace/page/)` that resolves outside the workspace stays `external-path`.
- `[X](/missing/page/)` with no candidate stays `external-path`.
- `[X](image.png)` is unaffected.
- `resolveLinkTarget` remains a pure function (file-index lookup passed in, not imported).
