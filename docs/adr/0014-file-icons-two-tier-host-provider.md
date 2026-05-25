# ADR-0014: File icons — bundled glyphs + per-host OS icon provider

- **Status:** Accepted
- **Date:** 2026-05-24

## Context

A file manager lives or dies on its file list, and users expect the **same
icons the OS file manager shows** — the registered app icon for `.pdf`, the
embedded icon of a specific `.exe`/`.lnk`, the system folder icon. But "the
icon a file has" is deeply OS-specific and not a property of the filesystem:

- **Windows** — the real icon comes from the shell, not a registry string.
  `HKCR\.ext → ProgID → DefaultIcon` covers only *simple* static types; many
  types resolve through a COM **icon handler** (`.lnk`, per-file `.exe` icons)
  or a **thumbnail provider** (images/video). The robust APIs are
  `SHGetFileInfo` / `IShellItemImageFactory` — native calls, not a file read.
- **macOS** — `NSWorkspace.iconForFile` / `iconForContentType`.
- **Linux** — XDG icon themes + MIME type (`gio`, `xdg-mime`, freedesktop
  icon lookup); no single authority, varies by desktop environment.
- **Electron** — `app.getFileIcon(path)` wraps the native call, returns a
  `NativeImage`.
- **Terminal** — no raster icons at all; at best a Nerd-Font glyph.
- **Mobile (RN)** — platform document-picker style icons; rarely per-file.

So icon resolution is a **cross-cutting host capability** like windowing
([ADR-0008](./0008-process-surface-decoupling.md)) — emphatically *not* a
method on `FsPlugin`. A `file:` listing from the node sidecar and a `mock:`
listing should both be able to show a real `.pdf` icon; conversely an `s3:`
object's icon is still "whatever this OS shows for `.pdf`," decided by the
host, not the FS plugin. Tying icons to the FS plugin would fork icon logic
across every scheme and strand it on platforms whose FS plugin happens not to
implement it.

We also can't block the listing on icon resolution: a 1000-row directory must
paint immediately, and per-file shell calls are slow.

## Decision

**Two tiers**, and a **host-provided icon service** consumed through a React
context — never through `FsPlugin`.

### Tier 1 — bundled glyphs (always, everywhere)

`RowIcon` maps `(kind, extension)` to a bundled Lucide glyph synchronously.
Zero round-trips, fully cross-platform, no host support required. This is the
baseline and the permanent fallback. It is what renders on first paint and on
any host with no icon provider (mobile, terminal, a misconfigured web build).

### Tier 2 — OS-accurate icons (where a host provides them)

An **icon provider** resolves a coarse **cache key** to an image. The client
`IconCache` (in `@bc/file-list`) dedups by key, batches lookups into one
round-trip, and notifies only the rows whose key resolved (via
`useSyncExternalStore`). `RowIcon` shows the Tier-1 glyph until/unless the OS
image arrives, then swaps to it.

**Cache key granularity** — the crucial decision for cost:

- `dir` — one shared folder icon.
- `ext:.<ext>` — **one icon per file type**; collapses a 1000-file directory
  to a handful of extractions. Type icons are OS-global, so they work for any
  scheme (a `mock:` `.pdf` can show the real Windows pdf icon).
- `path:<uri>` — per-file, only for `exe` / `lnk` / `ico` (their icon is
  embedded in the file). `file:` scheme only.

The provider is **transport-agnostic**; only the wiring is host-specific:

- **Web** (current): the node-fs sidecar exposes `GET /icons?keys=…` returning
  `{ key: dataURL }`, dispatching to the host OS's extractor. The app injects a
  fetcher into `IconCache` and provides it via `IconContext`.
  - **Windows**: one batched PowerShell run that P/Invokes `SHGetFileInfo` —
    `SHGFI_USEFILEATTRIBUTES` for `ext:`/`dir` (no real file needed), the real
    path for `path:` — converts the `HICON` to a 16px PNG and base64-encodes it.
  - **macOS**: one batched `osascript -l JavaScript` (JXA) run that asks
    `NSWorkspace` for each icon (`NSImageNameFolder` for `dir`,
    `iconForFileType:` for `ext:`, `iconForFile:` for `path:`), rasterizes onto
    a 16px canvas, and emits `{ id: base64png }`. `.app` bundles are `dir`
    entries but resolve per-`path:` so each shows its own bundle icon. Needs a
    WindowServer connection (drawing) — i.e. the server runs in the user's GUI
    session, the same desktop constraint as the Windows shell APIs.
- **Electron** (future): provider calls `app.getFileIcon(path).toPNG()`; no
  sidecar.
- **fx-shell** (future): XPCOM / `moz-icon://` URIs.
- **Linux node host** (future): XDG icon theme + MIME lookup (`gio` / freedesktop).
- **Terminal / mobile** (future): no provider → Tier 1 only.

## Consequences

- **Accurate icons, cheaply.** Per-type keying means browsing a real directory
  costs ~10 extractions, not 1000; repeat types are free after the first dir.
- **Never blocks the list.** Glyph-first, swap-on-arrival; resolution is async,
  batched, and off the render path.
- **Icons are host-injected, not plugin-coupled.** `RowIcon` stays
  platform-agnostic; a host with no provider degrades cleanly to glyphs.
- **Windows + macOS Tier 2 today.** Both web paths ship; Linux, Electron, and
  fx-shell still need their own provider impl. The contract and the client cache
  are written once and reused — only the per-host fetcher/extractor differs, and
  `resolveIcons` simply dispatches on `platform()`.
- **Subprocess cost & fidelity ceiling.** Process startup is slow on both hosts
  (PowerShell, `osascript`), so we batch one run per request. The shell APIs
  give ~16–32px associated icons but **no thumbnails and no hi-DPI**. Upgrading
  to a native addon (Windows `IShellItemImageFactory::GetImage`; macOS
  `iconForFile` at a larger `NSSize` or `QLThumbnailGenerator`) is a later,
  isolated change behind the same provider contract.
- **Proprietary-asset constraint.** Extracted OS icons (and `shell32` system
  icons) are platform assets — fine to render locally for the user, but they
  **must never be committed or redistributed**. The cache lives in memory / a
  temp dir, same rule as the TC icons under `tools/visual`.
- **No cross-restart persistence yet.** The cache is in-memory on both sides;
  a restart re-extracts. An IndexedDB (client) / temp-dir (server) persistent
  cache is a cheap future add.
- **`""` means "resolved, no icon".** The client caches a negative result so a
  type the OS has no icon for doesn't refetch every render.

## Alternatives

- **Read the registry directly (Windows).** Misses icon-handler and
  thumbnail-provider types (`.lnk`, per-file `.exe`, images) — exactly the ones
  users notice. Rejected: only the shell APIs are correct.
- **Ship raw `.ico` to the browser.** Browsers render `.ico` but pick an
  arbitrary embedded size and give no alpha/size control; we'd still need a
  decoder (`icojs`) for embedded resources. Server-side conversion to a sized
  PNG is simpler and exact.
- **Native addon from day one** (`IShellItemImageFactory`). Best fidelity
  (thumbnails, hi-DPI), but adds a node-gyp/prebuild toolchain per arch.
  Deferred behind the provider contract; PowerShell is "good enough" for cut 1.
- **Icons as an `FsPlugin` method.** Forks icon logic across schemes and
  strands it per-plugin; an `s3:` plugin shouldn't reimplement Windows icon
  lookup. Rejected in favor of a host capability.
- **Per-path keys for everything (exact icon per file).** Accurate but turns a
  1000-file dir into 1000 extractions. Reserved for `exe`/`lnk`/`ico` and
  (later) thumbnails, where per-file really differs.
- **Server-rendered thumbnails now.** Valuable for image/video dirs but needs
  the native image-factory path; out of scope for the first cut.
