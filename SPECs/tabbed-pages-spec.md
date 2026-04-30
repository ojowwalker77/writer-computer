# Tabbed Pages Spec

## Summary

Generalize tabs into a **kind-agnostic shell**. Any tab — file, settings, launcher, or future surfaces like an index page or an html preview — goes through the same renderer loop, tab bar, session format, and back/forward history. All kind-specific behavior lives behind a **strategy registry**, and every call site dispatches through it instead of switching on `kind`. Ship Settings as the first non-file inhabitant.

Today the code has two shapes of kind-specific branching that block extension:

1. **Settings short-circuits the entire editor area.** `editor-area/index.tsx:45-51` early-returns `<SettingsPanel />` and hides the tab bar entirely while settings is open. Closing settings drops back into the previous tab state; there is no concept of "settings is a thing you're viewing alongside your documents."
2. **Kind-specific `if` ladders are scattered.** `tab.kind === "file"` gates appear in `EditorArea`, `EditorTabs` (title, context-menu), the footer, `deriveActiveFilePath`, `collectReferencedPaths`, the rename/delete iterators, session serialization, and keyboard shortcuts. Adding a third kind means editing every site.

Fix both by reshaping the tab model so every kind-specific behavior lives behind a single strategy registry, with TypeScript enforcing completeness. The payoff: adding a kind is one new module in `page-kinds/` plus one line in the registry index. No edits to the orchestrator, the tab bar, session code, or the path-rewrite iterators.

## Goals

- Settings opens in a tab, indistinguishable from other tabs at the shell level (same tab bar, close button, context menu, drag targets, keep-alive semantics).
- Adding a new page kind is **closed over modification**: no edits to `EditorArea`, `EditorTabs`, `use-keyboard-shortcuts`, session code, the watcher path collector, or the rename/delete iterators. TypeScript's exhaustive-map type forces registration of a new kind at compile time.
- Zero `location.kind === …` checks outside of `page-kinds/` and the one `Cmd+,` shortcut handler (where naming "settings" is the product intent).
- Back/forward history is per-tab and **kind-agnostic** — works across kind transitions (e.g. an index page → open a file in the same tab → back returns to the index; settings subcategory → back to settings root).
- `Cmd+,` focuses the existing settings tab if one is open; otherwise opens one in place of the active launcher or appends a new tab. Built on a reusable `openOrFocus` primitive, not a settings-specific action.
- Session format is kind-agnostic — serializes each tab's current location + back/forward history regardless of kind. Old file-only snapshots load without error.
- No regression in file-tab performance budgets established by `editor-tab-switch-performance-spec.md`.

## Non-Goals

- Multiple settings tabs (singleton semantics; implemented as `openOrFocus(matchSettings, createSettingsTab)`, not as a settings-specific action).
- A runtime plugin API for external page kinds. The registry is an internal seam, not an SDK.
- Drag-to-reorder tabs changes. Existing DOM order is preserved.
- Per-page state beyond what the owning store already holds. Settings state lives in `useSettingsStore`; a settings tab's location is a thin pointer.
- Changing `SettingsPanel` internals (search, category sticky headers, controls). Only its mount point moves.
- A second registry that dispatches on file content type (`.md` vs `.mdx` vs `.html`). File tabs all render markdown today; content-type dispatch is a follow-up that layers _inside_ the `file` page-kind's renderer.

## Approach

### 1. Tab shape: `Tab` + `Location`

Replace the current `EditorTab` discriminated union with a base tab that owns history. The kind-bearing data is a `Location`; the tab is otherwise kind-agnostic.

The `Location` union is **derived from the page-kind registry** (§2) — each kind module exports its own location type, and `page-kinds/index.ts` assembles the union. The store just re-exports it. Adding a new kind means adding its module; the union expands automatically.

```ts
// apps/desktop/src/stores/editor-store.ts
export type { Location } from "@/components/editor-area/page-kinds";

export interface Tab {
  id: string;
  location: Location;
  back: Location[];
  forward: Location[];
}
```

Consequences:

- `tab.kind` goes away. Selectors like `deriveActiveFilePath` no longer branch on kind — they call `pageKind(tab.location).primaryPath(tab.location)` (§2).
- History is general. `navigateTo(tabId, location)` pushes the current location onto `back` and sets the new one. Wiki-link clicks, sidebar clicks, and future "open this file from an index page" clicks all funnel through the same action and work across kinds.
- File-specific state (path, history) is no longer struct-level; it's what you get when `location.kind === "file"` — exposed only via registry methods so call sites don't need the kind check.

Creators return fully-formed tabs (with empty history):

```ts
function createFileTab(path: string, id = createTabId()): Tab {
  return { id, location: { kind: "file", path }, back: [], forward: [] };
}
function createLauncherTab(id = createTabId()): Tab {
  return { id, location: { kind: "launcher" }, back: [], forward: [] };
}
function createSettingsTab(id = createTabId()): Tab {
  return { id, location: { kind: "settings" }, back: [], forward: [] };
}
```

A generic `openOrFocus` helper in the store replaces kind-specific open actions:

```ts
openOrFocus: (match: (tab: Tab) => boolean, factory: () => Tab) => void;
```

Semantics: if a tab matches, activate it; else if the active tab is a launcher, replace it with `factory()`; else append. `Cmd+,` calls `openOrFocus((t) => t.location.kind === "settings", createSettingsTab)`.

### 2. Page-kind registry (strategy pattern)

New directory `apps/desktop/src/components/editor-area/page-kinds/`. The registry has exactly three layers:

- `types.ts` — generic types only. `PageKind<K, L>` (the full contract) and `SerializedLocation` (the wire shape). **No specific location types live here.**
- One self-contained module per kind (`file.tsx`, `launcher.tsx`, `settings.tsx`). Each owns its location type, its pure behavior, and its React component, and exports a single `PageKind<"…", Location>` record.
- `index.ts` — the one central list. Imports each kind module, assembles them in an `as const` tuple, derives the `Location` union from it, and exposes the agnostic dispatch (`pageKind`, `serializeLocation`, `deserializeLocation`).

**Adding a new kind = create one module + register it in one place** (`index.ts`'s `kinds` array). No edits to `types.ts`, to any other kind, to the store, to `EditorArea`, `EditorTabs`, session code, the watcher, or the rename/delete iterators.

```ts
// page-kinds/types.ts — generic only, no kinds mentioned
export interface SerializedLocation {
  kind: string;
  [key: string]: unknown;
}

export interface PageKind<K extends string = string, L extends { kind: K } = { kind: K }> {
  kind: K;
  fromPayload: (data: SerializedLocation) => L | null;
  title: (l: L) => string;
  paths: (l: L) => string[];
  primaryPath: (l: L) => string | null;
  rewritePath: (l: L, from: string, to: string) => L | null;
  removePath: (l: L, path: string) => L | null;
  serialize: (l: L) => object | null;
  supportsFileContextMenu: boolean;
  keepAlive: boolean;
  Component: ComponentType<{ location: L; isActive: boolean }>;
  renderFooter?: (l: L) => ReactNode;
}
```

```ts
// page-kinds/index.ts — the one central list
import { fileKind, type FileLocation } from "./file";
import { launcherKind, type LauncherLocation } from "./launcher";
import { settingsKind, type SettingsLocation } from "./settings";

// Add a new kind: import it + drop it in this tuple. Nothing else.
const kinds = [fileKind, launcherKind, settingsKind] as const;

export type Location = FileLocation | LauncherLocation | SettingsLocation;

const byKind = new Map(kinds.map((k) => [k.kind, k]));

export function pageKind<L extends Location>(loc: L): PageKind<L["kind"], L> {
  const k = byKind.get(loc.kind);
  if (!k) throw new Error(`Unknown page kind: ${loc.kind}`);
  return k as PageKind<L["kind"], L>;
}

export function serializeLocation(location: Location): SerializedLocation | null {
  const payload = pageKind(location).serialize(location);
  if (payload === null) return null;
  return { kind: location.kind, ...payload };
}

// Agnostic: iterates via fromPayload, so adding a kind doesn't edit this.
export function deserializeLocation(data: SerializedLocation | null): Location | null {
  if (!data) return null;
  const k = byKind.get(data.kind);
  if (!k) return null;
  return k.fromPayload(data) as Location | null;
}
```

**Example kind module — one file for everything:**

```tsx
// page-kinds/file.tsx
export type FileLocation = { kind: "file"; path: string };

export const fileKind: PageKind<"file", FileLocation> = {
  kind: "file",
  fromPayload: (data) => (typeof data.path === "string" ? { kind: "file", path: data.path } : null),
  title: (l) => getFileName(l.path),
  paths: (l) => [l.path],
  primaryPath: (l) => l.path,
  rewritePath: (l, from, to) => (l.path === from ? { ...l, path: to } : l),
  removePath: (l, path) => (l.path === path ? null : l),
  serialize: (l) => ({ path: l.path }),
  supportsFileContextMenu: true,
  keepAlive: true,
  Component: ({ location, isActive }) => <EditorPane path={location.path} isActive={isActive} />,
  renderFooter: (l) => <DocumentFooter filePath={l.path} />,
};
```

`settings.tsx` and `launcher.tsx` follow the same shape — each file carries its `Location` type and its `PageKind` record.

Why keep-alive for settings and file but not launcher: settings has form/scroll state worth preserving on switch; files own CodeMirror instances that are expensive to remount. Launcher has nothing to preserve and only one is ever useful at a time.

### 3. Tab-agnostic `EditorArea`

The editor area becomes a registry-driven loop with zero `kind ===` checks:

```tsx
function EditorArea() {
  const tabs = useOpenTabs();
  const activeTabId = useActiveTabId();
  const activeTab = useActiveTab();

  return (
    <div className="relative h-full overflow-hidden bg-editor-bg">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30">
        <div className="pointer-events-auto">
          <EditorTabs />
        </div>
      </div>
      <div className="relative h-full min-h-0 overflow-hidden">
        {tabs.map((tab) => {
          const k = pageKind(tab.location);
          const isActive = tab.id === activeTabId;
          if (!k.keepAlive && !isActive) return null;
          return <k.Component key={tab.id} location={tab.location} isActive={isActive} />;
        })}
      </div>
      {activeTab ? pageKind(activeTab.location).renderFooter?.(activeTab.location) : null}
    </div>
  );
}
```

The footer is a registry slot. `DocumentFooter` is wired by `fileKind.renderFooter`; every other kind omits it. The parent component doesn't know or care.

### 4. Settings panel as a keep-alive renderer

`apps/desktop/src/components/settings-panel/index.tsx` accepts `isActive` and applies the same visibility pattern as `EditorPane`:

```tsx
export function SettingsPanel({ isActive }: { isActive: boolean }) {
  // ... existing hooks unchanged ...
  return (
    <div
      className={
        isActive
          ? "relative z-10 h-full flex flex-col bg-editor-bg"
          : "absolute inset-0 invisible pointer-events-none h-full flex flex-col"
      }
      aria-hidden={!isActive}
    >
      {/* existing header / search / categories unchanged, minus the Close button */}
    </div>
  );
}
```

The header's in-panel Close button goes away — users close the settings tab with the tab's `×`, `Cmd+W`, or the context menu, just like any other tab.

Accessibility: `aria-hidden` on the inactive container prevents screen readers from announcing the offscreen settings form when a file tab is active. Inputs inside a `pointer-events-none` + `aria-hidden` container are also removed from the tab order; if testing shows focus can still land on hidden inputs, add the `inert` attribute.

### 5. Tab-bar UX

`EditorTabButton` becomes kind-agnostic. Title resolution is one line — dynamic wins if present, otherwise the kind's static title:

```tsx
function EditorTabButton({ tab, isActive, onSelect, onClose, onContextMenu }: Props) {
  const k = pageKind(tab.location);
  const path = k.primaryPath(tab.location);
  const isLoading = useIsFileLoading(path ?? "");
  const saveError = useFileSaveError(path);
  const dynamicTitle = useResolvedDocumentTitle(path); // returns null when path is null
  const title = dynamicTitle ?? k.title(tab.location);
  // ... render unchanged ...
}
```

The loading/save-error hooks are safe-for-null (they return no-op values when `path` is `null`), so there's no kind branch anywhere in the render path.

Context-menu gate: `if (!pageKind(tab.location).supportsFileContextMenu) return;` — replaces `if (tab.kind !== "file")`.

Icon (optional, polish): add `icon?: ReactNode` to `PageKind`. File tabs omit it; settings renders a small gear glyph before the label. Defer.

### 6. Keyboard shortcut wiring

`apps/desktop/src/hooks/use-keyboard-shortcuts.ts` — `Cmd+,` calls the generic primitive:

```ts
openOrFocus((tab) => tab.location.kind === "settings", createSettingsTab);
```

This is the one place outside `page-kinds/` that names `"settings"` — appropriate, because the shortcut's _meaning_ is "open settings." Any other kind's shortcut would follow the same pattern.

`Cmd+W` (`closeActiveTab`) is already kind-agnostic.

### 7. Session persistence

The wire format becomes kind-agnostic: each persisted tab serializes its current location + back + forward arrays of locations. Each serialized location is internally tagged with `kind`, and the kind-specific payload comes from `pageKind.serialize(location)`.

```ts
// frontend
export interface SessionLocation {
  kind: Location["kind"];
  // ...kind-specific payload merged in (e.g. { path } for file)
}
export interface SessionTab {
  location: SessionLocation;
  back: SessionLocation[];
  forward: SessionLocation[];
}
```

```rust
// Rust
#[derive(Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum SessionLocation {
    File { path: String },
    Settings,
    // Launcher intentionally absent — never persisted
}
#[derive(Serialize, Deserialize)]
pub struct SessionTab {
    pub location: SessionLocation,
    pub back: Vec<SessionLocation>,
    pub forward: Vec<SessionLocation>,
}
```

**No legacy support.** Sessions from before this spec (file-only, no `kind`) fail to deserialize and are silently dropped — the workspace opens with a fresh launcher tab. No migration code, no untagged fallback variant. Keeping the format pinned means there's exactly one shape to maintain and read.

**Save.** Iterate tabs, drop any where `pageKind(loc).serialize(loc)` returns `null` (launcher), tag the payload with `kind`, serialize history arrays the same way.

**Restore.**

```ts
for (const sessionTab of tabs) {
  const loc = deserializeLocation(sessionTab.location); // returns null for unknown kinds
  if (!loc) continue;
  const back = sessionTab.back.map(deserializeLocation).filter(notNull);
  const forward = sessionTab.forward.map(deserializeLocation).filter(notNull);
  created.push({ id: createTabId(), location: loc, back, forward });
}
```

Active-index handling is kind-agnostic.

### 8. Path handling via registry

Every operation that today branches on `kind === "file"` to mutate paths moves behind `rewritePath` / `removePath`. The store's iterators become uniform:

```ts
function collectReferencedPaths(tabs: Tab[]): string[] {
  return tabs.flatMap((tab) => [
    ...pageKind(tab.location).paths(tab.location),
    ...tab.back.flatMap((l) => pageKind(l).paths(l)),
    ...tab.forward.flatMap((l) => pageKind(l).paths(l)),
  ]);
}

function deriveActiveFilePath(tab: Tab | null): string | null {
  return tab ? pageKind(tab.location).primaryPath(tab.location) : null;
}

function applyRename(tabs: Tab[], from: string, to: string): Tab[] {
  const rewrite = (l: Location): Location | null =>
    pageKind(l).rewritePath(l as never, from, to) as Location | null;
  return tabs.flatMap((tab) => {
    const newLoc = rewrite(tab.location);
    if (!newLoc) return []; // current location invalidated → drop tab
    return [
      {
        ...tab,
        location: newLoc,
        back: tab.back.map(rewrite).filter(notNull),
        forward: tab.forward.map(rewrite).filter(notNull),
      },
    ];
  });
}
```

`applyDelete` follows the same shape via `removePath`. For non-file kinds, both methods return the location unchanged — so the iterator doesn't care whether a given tab is file-backed.

When a file tab's current location is invalidated (its file was deleted), the iterator could alternately step back through `back` looking for a surviving location rather than dropping the tab. Pick one policy; document it. Recommend: drop the tab, matching today's behavior where a deleted open file closes the tab.

### 9. Hooks / state access

Per `docs/react-guidelines.md`:

- Add `useOpenOrFocus` (wraps the store action).
- Remove `useSettingsPanel` / `useIsSettingsPanelOpen`.
- `useOpenTabs`, `useActiveTab`, etc. unchanged in spirit — they return the new `Tab` shape.

## Performance Notes

This spec preserves `editor-tab-switch-performance-spec.md` budgets and introduces no new per-switch work:

- **File-tab switching**: unchanged. File tabs still render via `EditorPane`; the registry is a single property lookup per render, not per switch.
- **Cross-kind switch**: both stay mounted if `keepAlive` is true on both sides. Per-switch work is a CSS class toggle on two elements and one React reconciliation over the tab bar — same class of work as two file tabs swapping.
- **First `Cmd+,`**: settings panel mounts for the first time. Existing SettingsPanel hydrates synchronously because settings are pre-fetched at startup; no change.
- **Memory**: one extra mounted React subtree per keep-alive non-file tab. Negligible relative to a single markdown document.

The registry is a module-level object — zero runtime cost. The `keepAlive` branch in `EditorArea` short-circuits non-keep-alive inactive kinds (today just launcher), preserving current behavior.

## Files Expected To Change

- `apps/desktop/src/stores/editor-store.ts` — `Tab` + `Location` types, `openOrFocus` action, registry-driven iterators, generalized history.
- `apps/desktop/src/stores/ui-store.ts` — remove `isSettingsPanelOpen`, `openSettingsPanel`, `closeSettingsPanel`.
- `apps/desktop/src/hooks/use-settings-panel.ts` — delete.
- `apps/desktop/src/hooks/use-tabs.ts` — add `useOpenOrFocus`, selectors now return `Tab`.
- `apps/desktop/src/hooks/use-keyboard-shortcuts.ts` — `Cmd+,` uses `openOrFocus`.
- `apps/desktop/src/components/editor-area/page-kinds/types.ts` — generic `PageKind` / `SerializedLocation` types. Agnostic, no enumeration of kinds.
- `apps/desktop/src/components/editor-area/page-kinds/index.ts` — central registry list + agnostic `pageKind`, `serializeLocation`, `deserializeLocation`. The single place to register a new kind.
- `apps/desktop/src/components/editor-area/page-kinds/file.tsx` — self-contained file kind (location type + behavior + component).
- `apps/desktop/src/components/editor-area/page-kinds/settings.tsx` — self-contained settings kind.
- `apps/desktop/src/components/editor-area/page-kinds/launcher.tsx` — self-contained launcher kind.
- `apps/desktop/src/components/editor-area/index.tsx` — registry-driven loop; drop the settings early-return.
- `apps/desktop/src/components/editor-area/editor-tabs.tsx` — kind-agnostic title + context-menu gate.
- `apps/desktop/src/components/settings-panel/index.tsx` — `isActive` visibility prop; drop in-panel Close button.
- `apps/desktop/src-tauri/src/commands/workspace.rs` (or wherever `SessionTabData` lives) — tagged-enum session shape. No legacy-format fallback: sessions written before this spec fail to deserialize and are dropped.
- `apps/desktop/src/lib/tauri.ts` — mirror widened session type.
- `apps/desktop/src/lib/session.ts` — serialize/deserialize via registry.
- Native menu wiring — swap `openSettingsPanel` → `openOrFocus(matchSettings, createSettingsTab)`.

## Testing

- **Unit**:
  - `openOrFocus` with settings predicate: opens if absent, focuses if present, replaces launcher when active tab is a launcher.
  - `closeTab` on a settings tab spawns a launcher if it was the last tab.
  - Rename via `rewritePath`: file locations in current + history rewrite; settings locations unchanged.
  - Delete via `removePath`: file location matching the deleted path invalidates (tab drops); settings untouched.
  - `collectReferencedPaths` aggregates file paths across tabs and their history; settings contributes `[]`.
  - `restoreSession` rehydrates a mix of file and settings tabs. Launcher tabs are never persisted.
- **Integration (Testing Library)**:
  - `Cmd+,` opens a settings tab; a second `Cmd+,` focuses the existing one. Only one settings tab in the tab bar.
  - Switching from settings → file → settings keeps both mounted (ref-equality on a test-only `data-mount-id`).
  - Back/forward works across kinds: simulate pushing a file location onto a settings tab's `back`, navigate back, assert the tab now renders the file.
  - Context menu on a settings tab omits file-only items.
- **Manual**:
  - Change a setting, switch to a file, edit, switch back — settings state preserved, no re-render flash.
  - Restart app with settings tab open and `workspace.restore-open-files` enabled — settings returns as active.
  - With only a settings tab open, `Cmd+W` closes it and a launcher replaces it.

## Acceptance Criteria

- Adding a new page kind requires exactly: (a) a new self-contained module in `page-kinds/` that owns its location type, pure behavior, and React component, and (b) one line in `page-kinds/index.ts` adding it to the central `kinds` tuple. **No edits to `types.ts`, to any other kind module, to the store, to `EditorArea`, `EditorTabs`, `use-keyboard-shortcuts`, `session.ts`, the path-rewrite iterators, or the footer wiring.** The `Location` union derives from the registered tuple via TypeScript inference, and `deserializeLocation` is agnostic — it dispatches through each kind's `fromPayload`.
- Zero `tab.location.kind === …` comparisons outside `page-kinds/` and the single `Cmd+,` handler.
- Back/forward navigation works across kind transitions (verified by a test that pushes a file location onto a settings tab's history and navigates back).
- `Cmd+,` opens-or-focuses a settings tab; singleton; tab bar remains visible.
- Settings and file tabs can coexist; switching does not remount either side (ref-equality assertions).
- Settings tab persists across app restart when `workspace.restore-open-files` is enabled. Pre-spec session files are dropped; affected workspaces open with a fresh launcher.
- `useUIStore` no longer owns settings-panel open/close state; `isSettingsPanelOpen`, `openSettingsPanel`, `closeSettingsPanel`, and `useSettingsPanel` are removed.
- Tab-bar right-click on a settings tab offers a sensible subset of the existing menu (Close, Close others, Close all) and omits file-only items.
- No regression in `editor-tab-switch-performance-spec.md` budgets: file-tab in-place navigation paint stays < 16 ms; cross-kind tab switches stay < 16 ms.
- No regression in settings functionality.
