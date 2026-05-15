# Boozy Captain — Architecture

> Senior-architect overview. High-level only — no full interfaces, no field-level API design.
> Companion to [`features-plan.md`](./features-plan.md). Status: **draft v0.1** — 2026-05-15.

---

## 1. Architectural goals

1. **One product, many shells.** A single component tree renders on web, desktop (Electron / Win32), mobile (Expo), terminal (`rn-terminal`), and XUL. Differences live at the edges, not the core.
2. **Pluggable everywhere it matters.** Filesystems, viewers, editors, archivers, and shell commands are plugins. The host is small; the platform is its plugin contracts.
3. **Capability-honest.** A plugin declares what runtime features it needs; the host refuses to load it on shells that can't provide them, instead of failing at runtime.
4. **Composable storage.** Every location — local disk, S3, a zip inside a tar on WebDAV — is reachable by a single URI.
5. **Replaceable UI primitives.** RN-Web is the default, but any heavy or desktop-y screen can be served by an HTML-native equivalent under Vite without forking the app.

Non-goals: hard plugin isolation in MVP, native-look parity per platform, mobile-first design.

## 2. Stack

### 2.1 Languages & build

- **TypeScript** everywhere (strict mode). Shared `tsconfig` base + per-package overrides.
- **Turborepo** as the monorepo orchestrator; **Yarn Berry** (v3/v4) workspaces underneath, configured with `nodeLinker: node-modules` in `.yarnrc.yml`. PnP is deliberately **off** — Metro, Module Federation, and several RN native-module postinstall scripts assume a real `node_modules` tree, and PnP breaks them.
- **Node 20 LTS** as the developer baseline; sidecar servers and Electron main run on the same.

### 2.2 UI

- **React 18** as the component runtime.
- **React Native 0.76 + react-native-web** as the universal UI layer. Renders to:
  - DOM (web, Electron renderer, Vite host),
  - native iOS/Android (Expo),
  - terminal cells (via `rn-terminal` adapter),
  - XUL widgets (experimental adapter).
- **Vite + Module Federation** for the HTML host (T4) and as the runtime plugin loader for all web-family shells. Bundling of the RN-side apps stays on **Metro** (Expo standard).
- **Expo** for the mobile shells (T5/T6) and for sharing config across web/mobile.
- **Electron** for desktop (T3 / T9). MSIX packaging via `electron-builder` for the Win32 variant.

### 2.3 State and data

- **Zustand** as the in-app store, one slice per major concern (panels, plugins, commands, settings). Picked over Redux Toolkit for ergonomics and RN-friendliness; picked over plain Context to avoid render-storm pitfalls in dense lists.
- **TanStack Query** for any cache-with-invalidation around remote VFS plugins (S3 list, WebDAV propfind).
- **Streams are the canonical I/O primitive.** Two pull-based primitives, deliberately:
  - **Web Streams** (`ReadableStream<Uint8Array>`) for **byte content** — file bodies, icon bytes, any binary payload. Standard, integrates with `fetch`/`Response`/`Blob`, works on web/Node 18+/RN (with polyfill on older RN). Cancel via `AbortSignal`.
  - **`AsyncIterable<T>`** for **structured streams** — directory entries, search results, watch events, progressive icon frames. Native language feature, no library; pause = stop awaiting, resume = `next()` again.
  - Avoided: Node streams (not portable), RxJS-everywhere (push-based — no native backpressure), Effect Streams (too big a commitment for the whole codebase).
  - Small helpers in `@bc/core`: a `pausable(iter)` wrapper that exposes explicit `pause()` / `resume()` for consumers (e.g., virtualized lists) that can't simply stop awaiting; a couple of object-stream operators (`map`, `merge`, `pushable`) — tiny surface, no framework.
- No `Buffer` in shared code; `Uint8Array` only.

### 2.4 Cross-cutting libraries

- **Lightweight event bus** in `packages/core` — no heavy dep. Pub/sub for FS watch events and command invocations.
- **zod** for plugin manifest validation and IPC boundary checks (cheap insurance at trust seams).
- **vitest** for unit tests; **Playwright** for the web app E2E; **Detox** for mobile (later).
- **xterm.js** as the optional embedded terminal widget for the cmd-line v2.
- **Monaco** as the optional code editor (v2 plugin; off by default on mobile/terminal).
- **WASM libraries** for archives: `libarchive`-derived for tar/rar read, native zip (`fflate` or similar) for write.

### 2.5 Transport (for client-server target T2)

- **HTTP + WebSocket** between the web client and the Node sidecar. WS for FS-watch events and long-running operation progress; HTTP for stateless requests.
- A single typed contract package (`packages/sidecar-protocol`) shared by both sides.

### 2.6 Windowing and long-running operations

Two decoupled abstractions ([ADR-0008](../adr/0008-process-surface-decoupling.md)):

- **`Process`** (`@bc/core`) — a long-running, headless-by-default operation with a state machine, progress as `AsyncIterable<ProgressEvent>`, and control methods. Examples: copy, move, search, archive extraction. Registered in a `ProcessRegistry` so multiple views can observe one operation.
- **`Surface`** (`@bc/surfaces` + platform adapters) — a UI region attachable to a Process (or rendering anything). Kinds: `modal`, `window`, `sheet`, `pill`. The platform adapter maps kinds to platform primitives (Electron `BrowserWindow`, RN `Modal`, in-app overlay, TUI panel).
- "Run in background" (TC-style) falls out of the model: close the surface, the process keeps running; a status-bar pill is just another surface bound to the same process.

## 3. Module layout

The repo is organized as **apps + packages + plugins**. Apps are thin compositions; packages are the platform; plugins are the extensibility surface.

```
boozy-captain/
├─ apps/             # one build target per directory
├─ packages/         # internal libraries (the platform)
└─ plugins/          # first-party plugins shipped with the apps
```

### 3.1 Apps (build targets)

Each app is a *composition* — it imports packages, picks a plugin set, applies build-target-specific glue, and ships an artifact. Apps contain almost no business logic.

| App | What it is |
|---|---|
| `apps/web-static` | Expo web export. Browser-only, FSA + OPFS. |
| `apps/web-node` | Same web client + Node sidecar. Talks over WS. |
| `apps/electron` | Electron shell wrapping the web client + node-side FS in the main process. |
| `apps/vite-host` | Vite + Module Federation host using `ui-html` where RN-Web is constraining. |
| `apps/mobile` | Expo app for Android first, iOS next. |
| `apps/terminal` | `rn-terminal` adapter — same tree, TUI output. |
| `apps/xul` | Experimental XUL renderer wrap. |
| `apps/win32` | `apps/electron` repackaged as MSIX / standalone exe. |

### 3.2 Packages (the platform)

| Package | Responsibility |
|---|---|
| **`@bc/core`** | Capability model, command + hotkey registries, event bus, settings store, panel state machine, `Process` + `ProcessRegistry`. Zero UI deps. |
| **`@bc/vfs`** | URI scheme registry, path utilities, transfer engine (copy/move with progress, conflicts), composition logic for archive-as-FS. |
| **`@bc/plugin-host`** | Plugin manifest validation, static and dynamic (MF) loading, capability gate, per-plugin permission UI. |
| **`@bc/surfaces`** | Platform-abstracted windowing: `SurfaceManager`, surface kinds (`modal`/`window`/`sheet`/`pill`), `SurfaceHandle`. Interfaces only — no rendering. See [ADR-0008](../adr/0008-process-surface-decoupling.md). |
| **`@bc/surfaces-web`** | Surface adapter for browser (in-app overlays + `window.open()`). |
| **`@bc/surfaces-electron`** | Surface adapter for Electron (`BrowserWindow` for real parallel windows). |
| **`@bc/surfaces-rn`** | Surface adapter for React Native (Modal, sheet, navigation routes). |
| **`@bc/surfaces-terminal`** | Surface adapter for the TUI renderer (panel splits). |
| **`@bc/ui-rn`** | RN/RN-Web components: `TwoPanelLayout`, `Panel`, `PathBar`, `FKeyBar`, `CmdLine`, `ListerFrame`, `EditorFrame`, `ProgressView`, status pill. The visual identity of the app. |
| **`@bc/ui-html`** | HTML-native equivalents for screens where RN-Web underperforms (virtualized grid, advanced drag-drop). Same component names, swapped at app level. |
| **`@bc/shell-runner`** | Abstraction over "run a command in a working directory" — child_process in node, fake shell in browser-pure, remote shell over WS in client-server. |
| **`@bc/sidecar`** | Node sidecar server (T2 only): expresses local FS, child processes, and credentials over the protocol. |
| **`@bc/sidecar-protocol`** | Shared types and zod schemas for the WS/HTTP protocol used by T2. |
| **`@bc/theme`** | Tokens (colors, spacing, typography), light/dark, TC-style palette. |
| **`@bc/i18n`** | Locale loading; en/ru initially. |
| **`@bc/test-utils`** | Mock FS, mock plugin host, RN testing helpers. |

### 3.3 Plugins (first-party)

| Category | Plugins |
|---|---|
| FS | `fs-mock` (hardcoded tree — walking-skeleton plugin), `fs-opfs`, `fs-fsa`, `fs-node`, `fs-android-saf`, `fs-webdav`, `fs-s3` |
| Archive-as-FS | `fs-zip`, `fs-tar`, `fs-rar` (read), `fs-7z` (v2) |
| Lister | `lister-image`, `lister-text`, `lister-hex`, `lister-media`, `lister-pdf` (v2) |
| Editor | `editor-notepad`, `editor-monaco` (v2) |
| Command / shell | `cmd-shell`, `cmd-bookmarks`, `cmd-search` |

Third-party plugins follow the same contract and load at runtime where the shell supports it.

## 4. Module interactions

### 4.1 Layered view

```
                    ┌──────────────────────────────────────┐
   build target ──▶ │            apps/<target>             │
                    │  picks plugins, wires bootstrap      │
                    └────────────┬─────────────────────────┘
                                 │
                    ┌────────────▼─────────────────────────┐
        UI layer    │  @bc/ui-rn   (or @bc/ui-html)  │
                    └────────────┬─────────────────────────┘
                                 │ uses
                    ┌────────────▼─────────────────────────┐
        platform    │  @bc/core   ◀──▶  @bc/vfs      │
                    │      ▲                  ▲            │
                    │      └──── @bc/plugin-host ───┐   │
                    └─────────────────────────────────────┘
                                 │ loads
                    ┌────────────▼─────────────────────────┐
       extensions   │  plugins/fs-*  lister-*  editor-*    │
                    │           cmd-*                      │
                    └──────────────────────────────────────┘
                                 │ (in T2 only)
                    ┌────────────▼─────────────────────────┐
        sidecar     │  @bc/sidecar  ◀── protocol ──▶ UI │
                    └──────────────────────────────────────┘
```

**Direction of dependencies is strict and downward.** UI depends on platform, platform depends on nothing app-specific. Plugins depend only on a stable host-API surface re-exported by `plugin-host`. Apps are the only thing that knows about a concrete target.

### 4.2 Plugin format and distribution

Plugins are **plain npm packages**. The `package.json` is the manifest — a `boozy` field carries our metadata (required capabilities, contributed schemes/listers/commands, MF remote entry).

- **Develop**: workspace package (`workspace:*` dep from the app).
- **Publish**: `yarn build && npm pack` → `.tgz` → push to a registry. Default is a self-hosted **Verdaccio**; the public npm registry is an option for OSS plugins.
- **Install (static)**: app declares the package as a dependency; bundler picks it up.
- **Install (runtime, Phase 2, web-family targets)**: user supplies registry URL + package name; host downloads the tgz (or the co-published MF remote), registers, and activates.

### 4.3 Plugin lifecycle

1. **Discovery.** The app's bootstrap declares a static plugin list; for shells that support runtime loading, additional plugins can be registered later via Module Federation manifests.
2. **Validation.** `plugin-host` parses `package.json#boozy` with zod, intersects required capabilities against the shell's capability set. Mismatches go to a "disabled" list with a human reason. No silent failures.
3. **Activation.** The host calls the plugin's `activate(hostApi)`. The plugin registers what it provides: VFS schemes, lister handlers, editor handlers, commands, hotkeys, settings panels.
4. **Use.** Other modules talk to plugin-provided functionality through the registries in `@bc/core` and `@bc/vfs`, never by name.
5. **Deactivation.** Symmetric `deactivate()` for runtime unload (v2 feature; MVP plugins are activated once).

### 4.4 Typical request flow — "open file in lister"

```
user F3
  │
  ▼
@bc/ui-rn (PanelView)
  │  dispatch command "lister.open"
  ▼
@bc/core  (command registry)
  │  resolve handler
  ▼
@bc/vfs   (stat the URI, get mime/ext)
  │  pick best lister via scoreboard
  ▼
plugin-host  (load lister bundle if not yet active)
  │
  ▼
lister-image (or text/hex/…)
  │  reads via @bc/vfs stream
  ▼
@bc/ui-rn (ListerFrame renders the plugin's view)
```

The same shape applies to F4 (editor), F5/F6 (transfer engine in `@bc/vfs`), and bottom-line commands (`@bc/shell-runner`).

### 4.5 Cross-app variation

Apps differ only in:
- which **plugin set** they bundle statically,
- which **transport** the FS plugins use (direct vs sidecar protocol),
- which **UI layer** they import (`ui-rn` vs `ui-html`),
- which **renderer adapter** boots `react` (DOM, native, terminal, XUL).

Everything else — panels, commands, hotkeys, plugin lifecycle — is identical, because it lives in `packages/core`, `packages/vfs`, and `packages/ui-*`.

### 4.6 Client–server interaction (T2 only)

The web client and the Node sidecar are two processes that share `@bc/sidecar-protocol`:

```
┌──────────────────┐         WS (events, streams)        ┌─────────────────┐
│  apps/web-node   │  ◀────────────────────────────────▶ │  @bc/sidecar │
│  (browser)       │         HTTP (one-shot ops)         │  (node process) │
│                  │                                     │                 │
│  fs-node-remote  │ ─── stat/list/read/write/watch ───▶ │  fs-node        │
│  cmd-shell-remote│ ─── spawn/stdin/stdout ───────────▶ │  child_process  │
└──────────────────┘                                     └─────────────────┘
```

`fs-node-remote` is a thin VFS plugin that *looks* identical to local `fs-node` from the rest of the app's point of view — same scheme, same operations — but its implementation marshals to the sidecar. This keeps the upper layers unaware of where the bytes come from.

## 5. Cross-cutting concerns

### 5.1 Stream model

Streams aren't just for file content — they're the default shape for *anything that arrives over time*. The UI stays responsive because consumers pull at their own pace and producers do work only when pulled.

**What is streamed**
- File content (read and write) — `ReadableStream<Uint8Array>`.
- File icons — bytes as `ReadableStream<Uint8Array>`, or *progressive* (placeholder → thumbnail → full) as `AsyncIterable<IconFrame>`.
- Directory listings — `AsyncIterable<Stat>`; entries are pushed to the panel as the FS plugin discovers them, so a 50k-entry folder renders the first screen immediately.
- FS watch events, search results, transfer progress — `AsyncIterable<…>`.
- Sidecar protocol responses (T2) — long-lived ops are WS streams that bridge straight into the same primitives on the client.

**Pause / resume**
- Both primitives are **pull-based**, so pausing is implicit: stop calling `read()` or `next()` and the producer stops working (backpressure all the way down).
- For consumers that don't control their own loop (virtualized lists, React effects that may unmount), `@bc/core` exposes a `pausable(iter)` wrapper with explicit `pause()` / `resume()` / `cancel()`.
- Concrete example: user opens F3 lister → the panel feeding the directory listing calls `pause()`, the FS plugin stops listing (and can close handles). On close → `resume()` picks up.
- Cancellation is first-class: every long op takes an `AbortSignal`; abort triggers `reader.cancel()` / iterator `return()` so producers can clean up.

**Why not one library**
- Web Streams alone forces object data through bytes — wasteful for `Stat` lists.
- RxJS alone has no native backpressure; pause/resume would be bolted on.
- Node streams aren't portable to RN/browser.
- Effect Streams are powerful but a major commitment for the whole codebase.

**Implications**
- The transfer engine in `@bc/vfs` is built on these primitives end-to-end (no full-buffer hops).
- React hooks in `@bc/ui-rn` adapt iterators into list state with cancellation tied to component unmount.
- Plugin authors get a tiny, standard surface — no Boozy-specific stream type to learn.

### 5.2 Other concerns

- **Cancellation.** Long ops accept an `AbortSignal`. UI surfaces a cancel button on every progress dialog.
- **Errors.** Typed error categories at module boundaries (permission, not-found, conflict, transport, plugin). Caught and translated to user prompts at the UI layer — never thrown into the void.
- **Settings & state persistence.** Per-target storage adapter behind one interface: `localStorage` / `IndexedDB` on web, `AsyncStorage` on RN, `electron-store` on Electron, file under `XDG_CONFIG_HOME` on terminal/XUL.
- **Logging.** Structured logger in `@bc/core` with adapters per target. Plugins get a scoped logger; the host can downgrade them to warn-only.
- **Security & capabilities.** Capability gating at load time; runtime-loaded plugins additionally require a user confirmation listing requested capabilities. Real per-plugin sandboxing (Web Worker realm + structured-clone API) is a v2 hardening goal.
- **Theming and i18n** are global concerns plumbed via React context; plugins can register their own strings and color tokens.

## 6. Build and CI

- Yarn Berry workspaces (`nodeLinker: node-modules`) + Turborepo task graph.
- Per-app build matrix in CI. A broken target fails its own pipeline only — the app/plugin compatibility matrix in `features-plan.md` is encoded as Turbo filters.
- Plugin packages publish two artifacts: a static ESM build (for app bundling) and a Module Federation remote build (for runtime load). Targets that can't load remotes ignore the latter.
- Releases are per-app; the platform packages are versioned together (changesets).

## 7. What lives where — quick lookup

- **Panels, F-bar, cmd line, dialogs, theme**: `@bc/ui-rn` (or `ui-html`).
- **"Where is this file? How do I read it?"**: `@bc/vfs` + an `fs-*` plugin.
- **"What does this format look like?"**: a `lister-*` or `editor-*` plugin.
- **"What does this key/menu/command do?"**: `@bc/core` command registry.
- **"What can this shell do at runtime?"**: capability set on the host; declared `requires` on plugins; verdict in `@bc/plugin-host`.
- **"How does the web client see the local disk?"**: `fs-node-remote` plugin in the client → `@bc/sidecar-protocol` → `@bc/sidecar` in node.
- **"How do we add a new build target?"**: new `apps/<name>` directory, pick a renderer adapter, pick the plugin set, ship.

---

*Deeper interfaces (VFS contract, plugin manifest, sidecar protocol shape) intentionally omitted — each gets a focused design note under `docs/packages/<name>.md` when implementation starts.*
