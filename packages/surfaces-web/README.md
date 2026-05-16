# @bc/surfaces-web

Web/Electron-renderer adapter for `@bc/surfaces`. Renders surfaces as in-app overlays.

**Exports**
- `WebSurfaceManager` — implements `SurfaceManager`; in-memory list of open surfaces, `subscribe(cb)` for React via `useSyncExternalStore`.
- `SurfaceLayer` — React component to mount on top of the app; renders all open surfaces with TC-style chrome.

**Mapping**
- `modal` — dimmed backdrop + centered chrome; **Esc** closes the top-most.
- `window` — free-floating panel; position via `options.position`.
- `sheet` — anchored to bottom (mobile-style).
- `pill` — small status chip in the corner.

A real OS `BrowserWindow` for `window` kind is the job of `@bc/surfaces-electron`.
