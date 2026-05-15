# ADR-0008: Process / Surface decoupling for windowing

- **Status:** Accepted
- **Date:** 2026-05-15

## Context

The product runs on platforms with very different windowing models:

- **Electron / Win32** — real OS windows, modal dialogs, multiple parallel windows.
- **Browser** — single window; in-app overlays for modals; `window.open()` for popups (with all the popup-blocker caveats).
- **Mobile (RN)** — no parallel windows; modals and bottom sheets only; navigation routes for "full screen" surfaces.
- **Terminal** — TUI panel system; no real windows; tmux-style splits at best.
- **XUL** — real XUL windows.

Application code and plugins need a uniform way to open modals, non-modal windows, mobile sheets, and small status indicators. Reaching for the platform primitive at each call site would fork the codebase.

Independently, a file manager has many **long-running operations** — file copy, move, recursive delete, archive extraction, search, large transfer over WebDAV/S3. These operations have three properties that don't fit a "dialog runs the operation" model:

1. **Backgroundable.** TC's "Run in background" button closes the progress dialog, but the operation must keep running.
2. **Observable from anywhere.** A status bar pill and an "Operations" panel may both show the same op. Multiple views of one operation.
3. **Outlive their UI.** A search started from one panel must survive panel switches, tab moves, and dialog close.

If we entangle "operation" with "dialog," background mode is a hack and multi-view is impossible. If we couple an operation to one UI shape, every new view re-invents the binding.

## Decision

Two **decoupled** abstractions, both first-class:

### Process

A long-running operation, **headless by default**. Lives in `@bc/core`.

- State machine: `idle → running → paused → completed | failed | cancelled`.
- Progress and events emitted as an `AsyncIterable<ProgressEvent>` (consistent with [ADR-0003](./0003-pull-based-streams.md)).
- Control methods: `pause()`, `resume()`, `cancel()`.
- Registered in a `ProcessRegistry` so any consumer can enumerate live operations.
- Examples: `CopyProcess`, `SearchProcess`, `ExtractProcess`, `WatchProcess`.

### Surface

A UI region that may attach to a Process — or render anything else. A new package `@bc/surfaces` defines the contract. Surface **kinds**:

- `modal` — exclusive focus, blocks parent.
- `window` — parallel, free-floating; may be a real OS window where the platform supports it.
- `sheet` — bottom-sheet (mobile-native idiom; desktop falls back to modal).
- `pill` — tiny ambient status indicator, always non-modal.

`SurfaceManager` is platform-abstracted:

```
host.surfaces.open(<ProgressView process={p}/>, { kind: "modal", title: "Copy" })
  → SurfaceHandle { close(), focus(), changeKind(...) }
```

Platform adapter packages map surface kinds to platform primitives, picked by the app at boot:

- `@bc/surfaces-web` — in-app overlay for `modal`/`pill`, `window.open()` (or another in-app pane) for `window`, modal for `sheet`.
- `@bc/surfaces-electron` — `BrowserWindow` for `window`, in-renderer overlay for `modal`/`pill`.
- `@bc/surfaces-rn` — RN `Modal` for `modal`, navigation route for `window`, bottom sheet for `sheet`.
- `@bc/surfaces-terminal` — TUI panel system; `window` becomes a split, `modal` is a centered panel that swallows input.

Plugins receive `host.processes` and `host.surfaces` via `HostApi`.

### TC "Run in background" as a derived feature

1. Copy starts → `ProcessRegistry` gets a new `CopyProcess`.
2. App opens `surfaces.open(<ProgressView process={p}/>, { kind: "modal" })`.
3. User clicks **Background** → app calls `handle.close()`. Process keeps running.
4. Status bar pill is a long-lived surface bound to the `ProcessRegistry`; it shows the running op.
5. Click the pill → `surfaces.open(<ProgressView process={p}/>, { kind: "modal" })` again, same process, fresh view.

Nothing special in the operation code; the feature falls out of the model.

## Consequences

- **Multiple views per operation, free.** Modal + pill at the same time is just two surfaces over one process.
- **Plugins are platform-agnostic for UI.** A lister plugin calls `host.surfaces.open(<View/>, { kind: "window" })` and gets the right shape on each platform.
- **Headless tests are easy.** Processes have no UI dep; they can be tested without rendering anything.
- **Adapter complexity.** Four to five adapter packages to maintain at parity. Acceptable.
- **Degradation on constrained platforms.** Mobile and terminal don't truly support `window` parallelism; their adapters degrade `window` to a sheet or full-screen route. Documented in the surface kinds spec.
- **Surface content must be serializable enough to remount.** When a user reopens a closed surface on the same process, the new view subscribes fresh to the process's `AsyncIterable` of events. The process implementation provides a `snapshot()` of current state so reattached views render correctly without replaying from the start.
- **State persistence story.** Live processes survive panel re-renders and tab switches. Surviving an app restart is out of scope for MVP; processes are in-memory.

## Alternatives

- **Modal-only API.** Cheap, kills the parallel-window story that desktop users expect, breaks the F3-lister UX immediately.
- **Separate APIs per surface type (`openModal`, `openWindow`, `openSheet`).** More to remember, harder to swap kinds at runtime, "run in background" needs ad-hoc plumbing per dialog.
- **React Navigation as the universal abstraction.** RN-centric. Doesn't model real OS windows. Forces every desktop screen into a route concept.
- **Couple operations to their progress dialog (TC's actual implementation, in spirit).** Familiar but the entanglement is exactly what we want to avoid — the moment you want a second view of one op, the model breaks.
- **One Process abstraction without Surfaces (operations are first-class but the UI just imports React components directly).** Solves backgrounding but not platform-uniform windowing.
