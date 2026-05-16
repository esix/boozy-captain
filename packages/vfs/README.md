# @bc/vfs

Virtual filesystem abstraction. Every location in the app is a URI ([ADR-0007](../../docs/adr/0007-uri-addressing-with-archive-composition.md)).

**Exports**
- `Uri`, `Stat`, `StatKind`, `FsPlugin` — the contract every FS plugin implements.
- `parseUri`, `buildUri`, `joinUri`, `parentUri`, `uriName` — URI helpers.
- `VfsRegistry` — scheme → `FsPlugin` map; dispatches `list` / `stat` by URI scheme.

Directory listings are pulled as `AsyncIterable<Stat>` so panels can render entries as they arrive; file content is a `ReadableStream<Uint8Array>`.
