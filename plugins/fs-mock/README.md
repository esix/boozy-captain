# @bc/fs-mock

A hardcoded directory tree, served as a regular `FsPlugin` under the `mock://` URI scheme. Used to bootstrap the walking skeleton and as a fixture for tests.

**Exports**
- `activate(host)` — registers `MockFs` with `host.vfs`. This is the entrypoint called by `@bc/plugin-host`.
- `MockFs`, `MockFsOptions` — the implementation; `delayMs` (default 50) is the artificial pause between yielded entries so the streaming UI is visible during dev.

**Manifest** (in `package.json`)
```
"bc": { "scheme": "mock", "capabilities": [], "requires": [] }
```

Zero runtime deps, no platform-specific code — runs on every target.
