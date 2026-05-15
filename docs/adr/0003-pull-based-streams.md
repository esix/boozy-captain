# ADR-0003: Pull-based streams as the canonical I/O primitive

- **Status:** Accepted
- **Date:** 2026-05-15

## Context

A file manager streams data constantly — file contents being copied, directory listings on remote storage, icon thumbnails arriving over the network, progress events from long ops, search results trickling in. We want the UI to render the first screen instantly and stay responsive while work continues in the background, including when the user pauses work (opens F3 lister, navigates away) and resumes it.

Push-based reactive libraries (RxJS, callbags) are excellent for UI fan-out but have no native backpressure — pause/resume is bolted on. Node streams aren't portable. Effect Streams are powerful but a heavy framework choice for the whole codebase.

## Decision

Two pull-based primitives, deliberately, and no framework:

- **`ReadableStream<Uint8Array>`** (Web Streams API) for **byte content** — file bodies, icon bytes, anything binary.
- **`AsyncIterable<T>`** for **structured streams** — directory entries, search results, watch events, progressive icon frames.

Pause is implicit: consumers stop pulling. For consumers that don't control their own loop, `@bc/core` provides a small `pausable(iter)` wrapper exposing `pause()` / `resume()` / `cancel()`. Cancellation is first-class via `AbortSignal` on every long op.

## Consequences

- Backpressure all the way down, by construction. A paused panel = a paused FS plugin = no wasted work.
- Standard primitives — plugin authors learn nothing Boozy-specific.
- Web Streams integrate naturally with `fetch`, `Response`, `Blob`, `<img>`.
- `AsyncIterable` composes with `for await`, easy to bridge into React hooks.
- We accept a small native gap: Web Streams need a polyfill on older RN versions, and older Safari was late on `for await` over streams. Both are tolerable today.
- We have to hand-roll a couple of helpers (`pushable`, `merge`, `map`) — surface area is tiny, no framework dependency.

## Alternatives

- **Web Streams everywhere.** Awkward for object data — `Stat` lists would have to be serialized through a byte channel.
- **AsyncIterable everywhere.** Throws away `ReadableStream`'s ergonomics for binary, including `Response` and `Blob` interop.
- **RxJS everywhere.** Push-based with no native backpressure; pause/resume needs operators bolted on. Heavy dep and a learning tax across plugins.
- **Node streams.** Not portable to RN/browser.
- **Effect Streams.** Powerful but too large a commitment for a plugin platform.
