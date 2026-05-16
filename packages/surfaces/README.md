# @bc/surfaces

Platform-abstract windowing interfaces ([ADR-0008](../../docs/adr/0008-process-surface-decoupling.md)). No rendering — only types.

**Exports**
- `SurfaceKind` — `"modal" | "window" | "sheet" | "pill"`.
- `SurfaceHandle` — `id`, `kind`, `close()`, `focus()`, `changeKind()`.
- `SurfaceContent` — render function `({ handle }) => ReactNode` so content can self-close.
- `SurfaceManager` — `open()`, `list()`, `get()`.

Concrete implementations live in platform packages: `@bc/surfaces-web`, future `@bc/surfaces-electron`, `@bc/surfaces-rn`, `@bc/surfaces-terminal`. Apps pick one at boot.
