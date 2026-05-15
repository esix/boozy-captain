# Boozy Captain — Features Plan

> Senior-analyst working document. Living plan: edited as decisions land.
> Status: **draft v0.1** — pre-MVP. Owner: `developer1@mpplabs.io`. Last reviewed: 2026-05-15.

---

## 1. Vision

A **2-panel, pluggable file manager** in the spirit of Total Commander / Far Manager, built once in TypeScript + React Native and shipped across **web, desktop, mobile, and terminal**. The product is a *shell* — the interesting work happens in plugins:

- **FS plugins** mount different filesystems (local, OPFS, WebDAV, S3, FTP, archives, git, …).
- **Lister plugins** view file contents (images, text, hex, audio, video, markdown, PDF, …).
- **Editor plugins** edit specific formats (notepad, JSON, …).
- **Command plugins** add operations to the bottom command bar and the F-key bar.

The same UI runs in many environments; plugins declare which environments they support, and the host hides what it can't run.

## 2. Goals & non-goals

**Goals**
- Total Commander parity on the *core interaction model*: two panels, keyboard-first, F1–F10 bar, command line, archives-as-folders.
- One codebase, many targets, via React Native + RN-Web + adapters.
- Plugin authors can ship a single bundle that loads at runtime via Module Federation (where the runtime supports it) or via static registration (where it doesn't).
- Clear capability model so a "web-only" build never crashes by trying to talk to `fs`.

**Non-goals (for now)**
- Pixel-perfect Total Commander clone — RN's layout primitives differ from Win32 widgets, and we'd rather get the *feel* right than chase native bitmaps.
- Full text-editor / IDE features (no LSP, no syntax-tree refactors).
- Server-side multi-tenant SaaS — the "client-server" build is single-user, local backend.

## 3. Glossary

| Term | Meaning |
|---|---|
| **Host** | The shell app (chrome, panels, command bar, plugin registry). |
| **Panel** | One of the two file lists. |
| **VFS** | Virtual filesystem abstraction. Every FS plugin implements it. |
| **Lister** | Read-only viewer for a file (F3 in TC). |
| **Editor** | Read/write editor for a file (F4 in TC). |
| **Capability** | A tagged feature flag: `fs.write`, `fs.watch`, `process.spawn`, `net.fetch`, etc. |
| **Build target** | A concrete buildable artifact: `web-static`, `web+node`, `electron`, `android`, `xul`, `terminal`, … |
| **Runtime profile** | The set of capabilities available at runtime: `browser-pure`, `browser+node`, `node`, `react-native`, `terminal`. |

## 4. Target users & primary use cases

- **Power user on Windows/Linux** replacing TC / Far / Double Commander.
- **Developer browsing remote storage** (S3, WebDAV, ssh) from the same app as local files.
- **Mobile user** moving files between SD card, cloud, and a desktop sibling via LAN.
- **Sysadmin in a terminal** running the RN-terminal renderer over SSH.
- **Embedder** — third party ships Boozy as the file-management surface in their tool, with a custom plugin set.

Primary jobs-to-be-done:
1. **Compare** the contents of two locations.
2. **Move/copy** with progress and conflict resolution.
3. **Inspect** files of unfamiliar formats without leaving the app.
4. **Pack/unpack** archives in place.
5. **Run** quick commands against the current directory.

## 5. Build targets

We commit to the following targets. The first three are MVP-tier; the rest are explicitly *experimental* and gated behind the plugin/capability model so they can lag without blocking core work.

| # | Target | Renderer | Runtime profile | Notes |
|---|---|---|---|---|
| T1 | **Web static** | RN-Web (Expo web build) | `browser-pure` | FS via `FileSystemDirectoryHandle` + OPFS. No server. |
| T2 | **Web + Node API** | RN-Web | `browser+node` | Node sidecar exposes local FS, archives, shell. Web client talks to it over WS/HTTP. |
| T3 | **Electron desktop** | RN-Web inside Electron | `node` | Full local FS, child processes, native dialogs. |
| T4 | **Vite HTML variant** | Plain React + HTML | `browser-pure` / `browser+node` | Escape hatch when RN-Web is too restrictive for a rich component (split panes, virtualized grids, drag-and-drop edge cases). Module Federation host. |
| T5 | **Android (Expo)** | React Native | `react-native` | SAF for storage, content-resolver URIs. |
| T6 | **iOS (Expo)** | React Native | `react-native` | Stretch; document picker + iCloud. |
| T7 | **Terminal** | `rn-terminal` (sibling project) | `node` + TTY | Same component tree rendered as TUI. Tracks the sibling project's maturity. |
| T8 | **XULRunner** | RN→XUL adapter | `node`-ish | Experimental. Useful as a "native-feel" app on legacy platforms. |
| T9 | **Win32 packed** | Electron / WebView2 wrapper | `node` | MSIX / standalone exe; same bits as T3. |

Build matrix is enforced by a `targets.json` per plugin and checked at compose time.

## 6. Monorepo layout (Turborepo)

```
boozy-captain/
├─ apps/
│  ├─ web-static/            # T1 — Expo web export
│  ├─ web-node/              # T2 — web client + node server
│  ├─ vite-host/             # T4 — Vite + Module Federation host
│  ├─ electron/              # T3 / T9
│  ├─ mobile/                # T5 / T6 — Expo
│  ├─ terminal/              # T7
│  └─ xul/                   # T8
├─ packages/
│  ├─ core/                  # types, capability model, event bus, command registry
│  ├─ vfs/                   # VFS interface + path utilities + URI scheme registry
│  ├─ ui-rn/                 # RN/RN-Web component library: Panel, Lister, CmdBar, …
│  ├─ ui-html/               # Vite-only HTML equivalents (T4 escape hatch)
│  ├─ plugin-host/           # Module Federation loader + sandbox + capability check
│  ├─ shell-runner/          # Adapter over child_process / WebContainer / mock
│  └─ test-utils/
├─ plugins/
│  ├─ fs-mock/               # Hardcoded directory tree — first plugin, no deps, every target
│  ├─ fs-opfs/               # Origin-Private FS (browser-pure)
│  ├─ fs-fsa/                # File System Access API (browser-pure, user-granted)
│  ├─ fs-node/               # node:fs (node profile)
│  ├─ fs-webdav/             # WebDAV client (any profile with net.fetch)
│  ├─ fs-s3/                 # S3 (any profile with net.fetch + creds)
│  ├─ fs-zip/                # Archive-as-FS — zip
│  ├─ fs-tar/                # tar / tar.gz / tar.bz2
│  ├─ fs-rar/                # rar (read-only; license-aware)
│  ├─ lister-image/          # jpg/png/bmp/webp/gif/svg
│  ├─ lister-text/           # text/markdown/source w/ syntax hl
│  ├─ lister-hex/            # binary hex view
│  ├─ lister-media/          # audio/video (where renderer supports)
│  ├─ editor-notepad/        # built-in text editor
│  └─ cmd-shell/             # bottom command line → shell-runner
├─ docs/
│  └─ features-plan.md       # ← this file
└─ turbo.json
```

The current single-app layout is migrated into `apps/mobile` (Expo source of truth) and the existing widgets/pages refactored into `packages/ui-rn` and `packages/core`.

## 7. Core architecture

### 7.1 Layers

```
        ┌───────────────────────────────────────────────┐
        │  app shell (per build target)                 │
        │  ┌─────────────────────────────────────────┐  │
        │  │  ui-rn  (or ui-html on T4)              │  │
        │  └─────────────────────────────────────────┘  │
        │  ┌─────────────────────────────────────────┐  │
        │  │  core: commands, hotkeys, panels state  │  │
        │  └─────────────────────────────────────────┘  │
        │  ┌─────────────────────────────────────────┐  │
        │  │  plugin-host: load, sandbox, capability │  │
        │  └─────────────────────────────────────────┘  │
        │  ┌─────────────────────────────────────────┐  │
        │  │  vfs: scheme registry, URI resolution   │  │
        │  └─────────────────────────────────────────┘  │
        │      ▲                ▲                 ▲     │
        │  fs-* plugins   lister-* plugins   cmd-* …    │
        └───────────────────────────────────────────────┘
```

### 7.2 Capability model

Capabilities are simple string tags advertised by the host and required by plugins:

- `fs.read`, `fs.write`, `fs.watch`, `fs.symlink`, `fs.permissions`
- `net.fetch`, `net.stream`, `net.ws`
- `process.spawn`, `process.tty`
- `clipboard.read`, `clipboard.write`
- `dialog.native`
- `crypto.subtle`
- `storage.persistent`

The host emits its capability set on boot. Plugin manifests declare `requires: ["fs.write","net.fetch"]`. Loader refuses to register plugins whose requirements aren't satisfied, and surfaces them in a "disabled plugins" UI with a reason.

### 7.3 VFS contract

```ts
// packages/vfs/src/types.ts
export type Uri = string; // e.g. "file:///c/work", "s3://bucket/k", "zip:///path/a.zip!/inner"

export interface Stat {
  name: string; uri: Uri;
  size: number; mtime: number; ctime?: number;
  kind: "file" | "dir" | "symlink" | "special";
  exec?: boolean; hidden?: boolean;
  mime?: string;
}

export interface FsPlugin {
  scheme: string;                       // "file", "s3", "zip", …
  capabilities: Capability[];
  list(uri: Uri): AsyncIterable<Stat>;
  stat(uri: Uri): Promise<Stat>;
  read(uri: Uri, range?: ByteRange): ReadableStream<Uint8Array>;
  write?(uri: Uri, data: ReadableStream<Uint8Array>, opts?: WriteOpts): Promise<void>;
  mkdir?(uri: Uri): Promise<void>;
  remove?(uri: Uri, opts?: { recursive?: boolean }): Promise<void>;
  rename?(from: Uri, to: Uri): Promise<void>;
  watch?(uri: Uri, cb: (ev: FsEvent) => void): Unsubscribe;
}
```

URIs are the single addressing system, including for *archive-as-FS*: `zip:///home/me/a.zip!/inner/path`. Composition is recursive: `zip://...!/inner.tar!/...`.

### 7.4 Plugin format

Plugins are **regular npm packages**. The `package.json` is the manifest — no parallel format to learn.

- Standard fields: `name`, `version`, `main`/`exports`, `dependencies`.
- Boozy-specific metadata under a `"boozy"` field: declared `capabilities` required, contributed VFS schemes / lister handlers / commands, MF remote entry name.
- Validated by `@bc/plugin-host` (zod schema) on load.

### 7.5 Plugin distribution

- **Develop** as workspace packages (`workspace:*`) — the apps depend on them directly during development.
- **Publish** with `npm pack` → `.tgz` → push to a registry. Default: a self-hosted **Verdaccio** so we don't depend on the public npm registry for first-party or private plugins. The public registry remains an option.
- **Static install** (Phase 1): app declares the plugin in its `dependencies`; bundler picks it up.
- **Runtime install** (Phase 2, web-family targets): user pastes a registry URL + package name, the host fetches the tgz (or the pre-built Module Federation remote co-published alongside it), unpacks/registers, and calls `activate(hostApi)`.

### 7.6 Plugin loading

- **Build-time (static)**: plugins in the app's dependencies are bundled and registered on boot. The only mode supported in restrictive runtimes (RN, terminal, XUL initially).
- **Runtime (dynamic)** via **Module Federation** for T1, T2, T3, T4, T9. A plugin ships a remote entry alongside its tgz; the remote exports an `activate(host)` function.
- **Sandboxing**: in browser-pure targets, plugins run in the same realm but only see `HostApi` and their declared capabilities. Hard isolation (Web Worker realm per plugin) is a v2 goal.

### 7.5 Command and hotkey registry

- Every action (copy, move, view, edit, refresh, mkdir, …) is a `Command { id, title, run, when }`.
- F-key bar, menus, context menus, and the bottom command line all bind to the *same* registry.
- Hotkeys are profile-aware (Total Commander mode, Far mode, custom). Defaults match TC.

## 8. UI features

### 8.1 Panels (left/right)

- Sortable columns: name, ext, size, date, attrs. Configurable per-panel.
- Quick filter, incremental name search.
- Tabs per panel (TC-style), with persistence.
- Drive/connection bar (`[ c: ][ d: ][ s3: ][ webdav: ]`).
- Selection: space toggles, `+`/`-` mask select, gray plus selects same ext.
- Path bar: editable URI, breadcrumbs, history.
- Status bar: count + size of selection.

### 8.2 F-key bar (bottom)

Bind defaults to TC where it makes sense:
`F1 Help • F2 Refresh • F3 View • F4 Edit • F5 Copy • F6 Move • F7 MkDir • F8 Del • F9 Menu • F10 Exit`

Each key is just a Command; plugins can override or stack.

### 8.3 Command line

- Always-visible bottom row.
- Input runs through `shell-runner`:
  - in node profiles: spawn a child process in the active panel's local dir;
  - in browser-pure: route through registered "fake shell" commands (cd, ls, plugin-provided);
  - in `web-node`: send to backend shell session.
- History, tab-completion against current panel.
- Output panel is pluggable (built-in basic, replaceable by a richer terminal plugin).

### 8.4 Lister / quick view (F3)

- Lister plugins register `canHandle(stat) → score`. Highest score wins; user can override and pin.
- Built-in listers:
  - **lister-image**: jpg/png/bmp/webp/gif/svg, EXIF, zoom/fit/100%.
  - **lister-text**: utf-8/16, line wrap, syntax highlight (lazy-loaded).
  - **lister-hex**: hex+ascii, jump-to-offset.
  - **lister-media**: where the renderer supports `<audio>`/`<video>`.
  - **lister-pdf**: stretch.
- Quick-view mode swaps the *opposite* panel into a lister of the focused file (TC Ctrl-Q).

### 8.5 Editor (F4) — built-in notepad

- Plain text editor, undo/redo, find/replace.
- Pluggable: a future `editor-monaco` can take over for code files where the capability `editor.monaco` is granted (off by default on mobile and terminal).
- Save-as supports any writable VFS scheme.

### 8.6 Archiver plugins

- `fs-zip`, `fs-tar`, `fs-rar` mount archives as folders under their own URI scheme.
- Pack: F5/F6 into an archive URI; format chosen by extension.
- Read-only archives degrade gracefully (no write button, copy-out works).

### 8.7 Windowing and background operations

The product separates **operations** from their **UI surfaces** ([ADR-0008](./adr/0008-process-surface-decoupling.md)). Application code and plugins call a single platform-abstracted API:

- `surfaces.open(<View/>, { kind: "modal" | "window" | "sheet" | "pill", title, … })` — returns a handle with `close()`, `focus()`, `changeKind()`.
- `processes.start(operation)` — returns a long-running, observable `Process` with progress, control methods (pause/resume/cancel), and a `ProcessRegistry` entry for global observation.

TC behaviors derived from the model:

- **Modal copy with "Run in background".** Copy → modal opens bound to the `CopyProcess`. User clicks Background → modal closes; process keeps running; a status-bar pill appears (another surface bound to the same process). Click pill → reopen modal.
- **Non-modal lister.** F3 opens a `window`-kind surface — a real OS window in Electron, an in-app pane on web, a navigation route on mobile.
- **Multiple simultaneous views.** A long search can be observed from both a side panel and a modal at once; they subscribe to the same process events.
- **Confirmations and prompts.** Just `modal` surfaces; no special API.
- **Toasts / notifications.** Short-lived `pill` surfaces, optionally process-bound.

Platform adapters live in `@bc/surfaces-{web,electron,rn,terminal}` — apps pick one at boot.

### 8.8 Plugin manager UI

- List installed, enabled, disabled-with-reason.
- "Load remote plugin…" (T1–T4, T9): paste a Module Federation manifest URL.
- Per-plugin permissions screen mirroring the capability tags.

## 9. Feature catalog and prioritization

Legend: **M** = MVP, **1** = v1, **2** = v2+.

| Area | Feature | Tier |
|---|---|---|
| Panels | Two panels, focus switch, tabs | M |
| Panels | Sort/filter/incremental search | M |
| Panels | Drive/scheme bar | 1 |
| Navigation | Path URI bar, history, breadcrumbs | M |
| Navigation | Bookmarks/favorites | 1 |
| Ops | Copy/move with progress, conflict prompts | M |
| Ops | Bulk rename (regex / mask) | 1 |
| Ops | Compare-by-content, sync dirs | 2 |
| Windowing | `Process` + `ProcessRegistry` (headless ops) | M |
| Windowing | `Surface` API + web adapter | M |
| Windowing | "Run in background" + status pill | 1 |
| Windowing | Electron `BrowserWindow` adapter | 1 |
| Windowing | RN sheet / route adapter | 2 |
| Windowing | Terminal panel adapter | 2 |
| VFS | Local FS (FSA / OPFS / node) | M |
| VFS | WebDAV | 1 |
| VFS | S3 | 1 |
| VFS | SFTP/FTP | 2 |
| VFS | git tree as FS | 2 |
| Archives | zip read/write | M |
| Archives | tar / tar.gz / tar.bz2 | 1 |
| Archives | rar read | 1 |
| Archives | 7z read/write | 2 |
| Lister | Image | M |
| Lister | Text + syntax HL | M |
| Lister | Hex | 1 |
| Lister | Media (audio/video) | 1 |
| Lister | PDF | 2 |
| Editor | Built-in notepad | M |
| Editor | Monaco-backed code editor | 2 |
| Cmd line | Shell input + history | M |
| Cmd line | Tab completion against panel | 1 |
| Cmd line | Embedded xterm.js terminal | 2 |
| Plugins | Static registration | M |
| Plugins | Runtime load via Module Federation | 1 |
| Plugins | Web Worker sandbox per plugin | 2 |
| Hotkeys | TC default profile | M |
| Hotkeys | Configurable, multiple profiles | 1 |
| Theming | Light/dark, configurable colors | 1 |
| i18n | en, ru | 1 |

## 10. Plugin × target compatibility matrix

Lists which plugins are expected to load on which targets. ✓ = supported, ⚠ = partial / read-only, ✗ = not loaded.

| Plugin | T1 web-static | T2 web+node | T3 electron | T4 vite | T5 android | T7 terminal |
|---|---|---|---|---|---|---|
| fs-opfs       | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| fs-fsa        | ✓ | ✓ | ✗ (use fs-node) | ✓ | ✗ | ✗ |
| fs-node       | ✗ | ✓ (server side) | ✓ | ⚠ (only with sidecar) | ✗ | ✓ |
| fs-android-saf| ✗ | ✗ | ✗ | ✗ | ✓ | ✗ |
| fs-webdav     | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| fs-s3         | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| fs-zip        | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| fs-tar        | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| fs-rar        | ⚠ | ✓ | ✓ | ✓ | ✓ | ✓ |
| lister-image  | ✓ | ✓ | ✓ | ✓ | ✓ | ⚠ (ascii-art) |
| lister-text   | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| lister-hex    | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| lister-media  | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| editor-notepad| ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| cmd-shell     | ⚠ (fake) | ✓ | ✓ | ⚠ | ⚠ | ✓ |

The matrix is the source of truth for CI build gating — a failing combination breaks the corresponding `apps/*` build, not the whole repo.

## 11. Roadmap

**Phase 0 — Scaffolding (1–2 weeks)**
- Migrate single Expo app → Turborepo (`apps/mobile`, `packages/core`, `packages/ui-rn`).
- Extract `FsPlugin` placeholder into `packages/vfs` with the real interface from §7.3.
- Package manager: **Yarn Berry** with `nodeLinker: node-modules` (PnP off — incompatible with Metro and Module Federation).
- CI: per-app build matrix.

**Phase 1 — MVP (T1 + T3)**
- *Walking skeleton first*: `apps/web-static` rendering one panel from `fs-mock` (hardcoded tree). Proves vfs → ui wiring with zero permission flow.
- Then layer in `fs-fsa` + `fs-opfs` + `fs-zip` + `lister-image` + `lister-text` + `editor-notepad`.
- `apps/electron` with `fs-node` + everything above.
- Panels, F-bar, command registry, hotkeys (TC profile), copy/move with progress.

**Phase 2 — Remote storage and dynamic plugins**
- `fs-webdav`, `fs-s3`, `fs-tar`, `fs-rar` (read), `lister-hex`, `lister-media`.
- Module Federation runtime plugin loading on T1/T3/T4.
- `apps/vite-host` (T4) live alongside RN-Web build.

**Phase 3 — Mobile + Server combo**
- `apps/web-node` with sidecar (Node + WS).
- `apps/mobile` (T5 first, T6 later) with SAF FS plugin and tablet-optimized layout.

**Phase 4 — Experimental renderers**
- `apps/terminal` over `rn-terminal` once that sibling stabilizes.
- `apps/xul` proof of concept.
- `apps/electron` repacked as `apps/win32` (MSIX).

## 12. Risks & open questions

- **Module Federation + RN/Metro** is not a paved path. We assume MF only inside web-family targets (T1, T2, T3, T4, T9) and use static plugin registration elsewhere. Worth a spike before Phase 2.
- **RN-Web ceiling for a dense desktop UI**: virtualized two-column grid with multi-select, drag-drop, and column resize is the riskiest UI item. T4 (Vite + HTML) exists specifically as a fallback if RN-Web becomes a bottleneck.
- **rar / 7z licensing** — `fs-rar` will be read-only via `libarchive`-derived WASM unless we change stance.
- **Capability spoofing** — until the v2 Web Worker sandbox lands, a malicious plugin loaded at runtime can do anything the host can. Runtime loading should be gated behind a user confirmation that lists requested capabilities.
- **rn-terminal maturity** is unknown to this plan. T7 stays experimental until proven.
- **iOS document picker quirks** may force a different navigation model on T6 vs T5; treat as separate UX work.

## 13. Open decisions to drive next

1. Package manager: **Yarn Berry** with `nodeLinker: node-modules` (decided — PnP is off because Metro/Module Federation require a real `node_modules`).
2. State management: Zustand vs Redux Toolkit vs plain context. (Recommend Zustand for speed; one store per panel.)
3. Hotkey library: roll our own (we need RN + Web parity) vs adapt `mousetrap` for web and a custom RN one.
4. Where the F-key bar lives on mobile (T5/T6) — bottom sheet? Long-press menu?
5. Auth/credentials storage for `fs-s3`, `fs-webdav` — OS keychain via Electron, IndexedDB-with-passphrase on web, SecureStore on mobile.

---

*This document is the entry point. Each numbered package/plugin gets its own design note under `docs/packages/<name>.md` as it's picked up.*
