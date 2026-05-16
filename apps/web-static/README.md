# @bc/app-web-static

Web build of Boozy Captain — Vite + React + react-native-web. Target T1 from [`docs/features-plan.md`](../../docs/features-plan.md): browser-only, no Node sidecar.

**Run**
```
yarn workspace @bc/app-web-static dev    # vite dev server
yarn workspace @bc/app-web-static build  # production bundle
```

**Boots**
- Builds a `HostCapabilities` set, constructs a `WebSurfaceManager`, calls `createHost`.
- Statically registers bundled plugins (currently `@bc/fs-mock`).
- Renders `App` with the two-panel layout, command line, F-key bar, and the surface overlay.

When more FS plugins land (FSA, OPFS, WebDAV, S3) this app will bundle them as workspace deps. Runtime Module Federation plugin loading comes in Phase 2.
