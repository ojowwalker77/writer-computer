# Landing Page Spec

## Summary

Ship a small marketing landing page for Writer that pitches the app, shows what it looks like, and funnels visitors to a signed macOS download.

The site is a sibling to the desktop app in this monorepo (`apps/website/`), built with the existing Vite+ toolchain, and deployed as a static bundle. v1 is one page, one primary call to action, no backend.

## Goals

- Give Writer a public URL to link from GitHub, release notes, and social posts.
- Explain in under ten seconds what Writer is and who it is for.
- Show the product — screenshots of real UI, not stock illustrations.
- Provide a working download button that always points at the latest signed DMG.
- Keep the site trivial to rebuild and redeploy when the app changes.

## Non-Goals

- No blog, changelog feed, or docs site in v1. `CHANGELOG.md` stays in-repo.
- No pricing, accounts, telemetry, analytics, or newsletter signup.
- No Windows or Linux download links until those builds exist.
- No CMS, MDX pipeline, or SSG framework (Astro, Next, etc.) — overkill for one page.
- No i18n. English only.
- No dark/light toggle; pick one theme and ship it.

## Audience and Positioning

Target reader: a writer or developer who already keeps notes, drafts, or docs as plain markdown files and wants a fast, lightweight editor that respects that.

Tone reference: [cogito.md](https://cogito.md/) — quiet, confident, product-led, lots of small named feature sections rather than one big grid. We are deliberately echoing that shape because it suits the same kind of audience. We are not echoing their "native" framing.

Tagline candidates (pick one during design, do not ship all):

- "A quiet markdown editor for your own files."
- "Fast, lightweight markdown for your local files."
- "Writer — markdown editing that stays out of the way."

Key differentiators to lead with:

- Local-first: edits plain `.md` files on disk, no sync service, no lock-in.
- Fast and lightweight: small download, quick cold start, minimal memory footprint.
- Works with existing vaults and docs repos (Obsidian-compatible links, gitignore-aware).

## Page Structure

One scrollable page, modeled loosely on cogito.md's section rhythm: hero, then a series of named feature sections each pairing a short headline with one screenshot or visual, then footer. Each section is a single idea — no card grids, no bullet soup.

Sections in order:

1. **Hero** — app name, tagline, one-sentence subhead, primary "Download for macOS" button, secondary "View on GitHub" link, hero screenshot of the editor.

2. **Writing** — "Write Markdown the way it was meant to be written." Covers the editing experience: dimmed/inline syntax, smart lists, formatting shortcuts, drag-and-drop image insertion, mermaid diagrams.

3. **Navigation** — "Find any file in an instant." Covers the command palette, fuzzy search across paths, fuzzy content search + grep, tabs, multi-window.

4. **Your files, your folders** — "Plain markdown on disk. Open it in anything." Covers local-first storage, gitignore-aware workspace, Obsidian-compatible wiki links and image embeds, tags. This is the section that replaces cogito's "For agents and humans" slot — same idea, different framing, no AI claims.

5. **Crafted details** — "Small things that add up." Covers performance (cold start, large workspaces), keyboard polish, auto-update, signed + notarized DMG, multi-window. This is where "fast and lightweight" lives.

6. **Power features** — "More than meets the eye." Covers anything that didn't fit above: frontmatter editing, mermaid, inline media preview, CLI companion (only if shipped at launch).

7. **Footer** — download link, GitHub link, version string, small "Built with Tauri" credit, copyright.

No carousels, no animations beyond subtle fade-in, no scroll-jacking. Each feature section is `image + heading + one short paragraph`, alternating image left/right.

### Feature claims to verify before writing copy

The sections above are scaffolded from cogito.md's content shape. Before writing final copy, confirm each claim is actually true of Writer today by checking shipped specs in `SPECs/` and the codebase. Known-shipped (from `TODOS.md` Done list): tabs, multi-window v1, fuzzy search + grep, gitignore-aware workspace, mermaid, frontmatter edit flow, extensionless markdown links, editor context menu, sidebar bulk actions, auto-update, signed/notarized DMG, writer-open CLI.

Likely **not** shipped and must not appear in v1 copy unless verified: AI summaries, document outline, tags, PDF export, social-publish integrations, custom folder icons, math rendering. If verification finds a feature missing, drop the bullet rather than soften it.

## Download Button Behavior

- Primary button links directly to the latest `.dmg` asset.
- Use the GitHub "latest release" redirect pattern so the URL never needs editing:
  `https://github.com/<owner>/<repo>/releases/latest/download/Writer_<arch>.dmg`
  (Exact filename must match what `scripts/distribute.sh` publishes. Confirm before shipping.)
- Show the current version beneath the button. Fetch at build time from `apps/desktop/src-tauri/tauri.conf.json` (`version` field) so the site and app never drift.
- If a release asset 404s, GitHub shows its own error page — acceptable for v1; no custom error handling.

Open question: Apple Silicon vs. Intel. If `distribute.sh` ships a universal DMG, one button. If it ships per-arch DMGs, the hero needs an arch picker or a single "Download" that links to a generic universal asset. **Resolve by inspecting `scripts/distribute.sh` before implementation.**

## Tech Stack

- New workspace: `apps/website/`, added to `pnpm-workspace.yaml`.
- Vite+ static build: `vp build` in that package produces `dist/`.
- React + TypeScript, matching the desktop app's stack so components and idioms carry over. No router — single page.
- Styling: plain CSS modules or a single global stylesheet. No Tailwind, no CSS-in-JS library.
- No runtime JS frameworks beyond React. Target a sub-100 KB gzipped bundle.
- Assets (screenshots) live under `apps/website/public/` as static PNGs. Export at 2x for retina.

Rationale for not using Astro/Next: the rest of the repo is Vite-native, the page is small, and avoiding a second toolchain keeps the agent-loop simple.

## Deployment

Recommended: **GitHub Pages** from a `gh-pages` branch or `/docs` output, published by a GitHub Action on push to `master` when `apps/website/**` changes.

- Action steps: `vp install`, `vp run build` (website package), publish `apps/website/dist/` via `peaceiris/actions-gh-pages` or the official Pages action.
- Custom domain: **open question for the user.** If yes, add a `CNAME` file to `apps/website/public/`. If no, use the default `*.github.io` URL.

Alternative hosts (Cloudflare Pages, Vercel) are fine but add a dashboard dependency; skip unless the user wants one.

## Content Sourcing

- Screenshots: take one per feature section (Writing, Navigation, Your files, Crafted details, Power features) at 1440×900 with the app's default theme on a realistic markdown file. Store under `apps/website/public/screenshots/`.
- Feature copy: write directly in JSX; no CMS. Each section: one short headline (≤ 60 chars) + one paragraph (≤ 220 chars).
- Tagline, subhead, and section copy: draft in the PR for review, not baked in during spec. Reference cogito.md's tone (quiet, declarative, no exclamation marks, no superlatives) when drafting.

## Accessibility and Performance

- All images have meaningful `alt` text.
- Hero and footer download links are real `<a>` tags with `download` attributes where appropriate.
- Works with JavaScript disabled for the core message and download link (render the hero in static HTML, hydrate for any interactive bits).
- Lighthouse Performance ≥ 95 on desktop, ≥ 90 on mobile. No web fonts heavier than one family + one weight; prefer system fonts.
- Responsive from 360px upward. No separate mobile page.

## Files Expected To Change / Add

- `apps/website/package.json` (new)
- `apps/website/vite.config.ts` (new)
- `apps/website/index.html` (new)
- `apps/website/src/main.tsx`, `src/App.tsx`, `src/components/*` (new)
- `apps/website/src/styles.css` (new)
- `apps/website/public/screenshots/*.png` (new)
- `apps/website/public/og-image.png`, `favicon.ico` (new)
- `pnpm-workspace.yaml` (add `apps/website`)
- `.github/workflows/deploy-website.yml` (new, if GitHub Pages)
- `TODOS.md` — add task entry linking here
- `CHANGELOG.md` — note public site on release

Explicitly **not** changed:

- No edits under `apps/desktop/`.
- No changes to `scripts/distribute.sh` (the site reads the existing artifact URL pattern).

## Open Questions

1. Custom domain, or default `github.io` subdomain for v1?
2. Universal DMG or per-arch builds? (Determines whether the hero needs an arch picker.)
3. Repo owner/name for the `releases/latest/download/...` URL — confirm the public slug.
4. Which tagline wins.
5. OG image: a cropped hero screenshot vs. a custom card — design call during build.
6. Which Writer features actually ship today vs. are planned (see "Feature claims to verify" above) — confirm before writing section copy so we do not over-promise.

## Acceptance Criteria

- Visiting the published URL on a cold cache shows the hero, tagline, and download button within one second on a typical connection.
- The download button starts a DMG download of the current signed release, not a redirect to a GitHub page.
- The displayed version string matches `apps/desktop/src-tauri/tauri.conf.json` `version`.
- `vp check` and `vp build` pass in `apps/website/`.
- A push to `master` that changes `apps/website/**` redeploys the site automatically.
- No desktop-app files changed by the PR that introduces the site.
