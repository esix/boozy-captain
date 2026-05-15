# ADR-0007: Single URI addressing scheme, archive composition by `!/`

- **Status:** Accepted
- **Date:** 2026-05-15

## Context

Storage in the product is heterogeneous: local disk, OPFS, the File System Access API, S3, WebDAV, archives, and (later) git trees and SFTP. Each could expose its own object model (paths, handles, keys, blobs). That would force every UI surface, every command, and every plugin-to-plugin interaction to know about each model.

We also need to address *files inside archives*, including nested archives — a zip in a tar on WebDAV is a realistic case.

## Decision

Use a **single URI string** to address every location in the system. Each FS plugin claims a **scheme** (`file:`, `s3:`, `webdav:`, `opfs:`, `zip:`, `tar:`, …) and is responsible for resolving URIs of that scheme.

Archive contents use a `!/` separator inside the URI to reference an entry within a container, recursively:

- `zip:///home/me/a.zip!/inner/path/file.txt`
- `zip://webdav://srv/data/x.zip!/deep/file`
- `tar://s3://bucket/archive.tar!/zip://...!/leaf.txt`

`@bc/vfs` parses, normalizes, and dispatches URIs; FS plugins never see paths from a scheme they don't own.

## Consequences

- Commands, transfers, history, bookmarks, and tabs all hold URIs. One data type at every seam.
- Archive plugins (`fs-zip`, `fs-tar`, `fs-rar`) implement the same interface as any other FS — there's nothing special about "archive as folder" except the URI shape.
- Nested archives compose for free because the inner URI is just another VFS lookup.
- Copy/move between two URIs is the same code path regardless of whether either endpoint is local, remote, or in an archive.
- We pay attention to URI encoding/escaping for filenames containing `!`, `/`, `?`, or `#`. Conventions live in `@bc/vfs` path utilities.
- Bookmarks and panel state become trivially serializable.

## Alternatives

- **Per-FS path objects (`LocalPath`, `S3Key`, …).** Type-safe, but every cross-FS operation needs adapters. Bookmarks and history become heterogeneous.
- **Opaque handles (FSA-style `FileSystemHandle`).** Works inside a process but doesn't serialize — kills bookmarks and crash recovery.
- **URI but no archive composition; archives mounted as virtual roots.** Forces global "mount table" state, complicates nested archives, surprises the user when archive context is implicit.
