# Walking Skeleton

> The smallest end-to-end slice that proves the architecture. One PR, ruthlessly scoped.
> Status: **draft v0.1** — 2026-05-15.

---

## Goal

Render **one panel** showing a directory listing from **`fs-mock`** (hardcoded tree) inside **`apps/web-static`**, with the listing flowing through the real `@bc/vfs` → `@bc/plugin-host` → `@bc/ui-rn` path as an `AsyncIterable<Stat>`.

If this works, the layered architecture is real, the plugin contract has been exercised end-to-end, and every later feature is an additive change.

## Definition of done

Acceptance is binary. All of these must be true:

1. `yarn install` succeeds from a clean checkout on Windows + macOS + Linux.
2. `yarn dev` (Turbo-driven) launches `apps/web-static` and opens a browser to a working URL.
3. The page shows a single panel listing the root of the `fs-mock` tree.
4. Clicking a folder navigates into it; clicking `..` goes up. Path bar reflects the current URI (e.g. `mock:///home/user`).
5. The list is populated incrementally from `AsyncIterable<Stat>` — visible even with an artificial 50 ms delay between yielded entries (proof of streaming).
6. Refresh button re-iterates and replaces rows.
7. `yarn typecheck` is green across all workspaces.
8. `yarn lint` is green.
9. One smoke test (`vitest`) asserts that `fs-mock.list('mock:///')` yields the expected entries.

That's it. Anything else is out of scope.

## Out of scope (intentionally)

- Second panel, panel focus switching.
- F-key bar, hotkeys, command registry beyond a stub.
- Command line / shell runner.
- Listers, editors, archivers.
- Copy / move / delete operations.
- Real FS plugins (`fs-fsa`, `fs-node`, `fs-opfs`).
- Module Federation runtime loading. Plugin is wired statically as a workspace dep.
- Theming, i18n, persistence, hotkey customization.
- Electron, mobile, terminal builds.
- Sidecar (T2).
- Verdaccio setup, `npm pack` publish flow. Plugin lives as a workspace package only.
- Capability gating beyond reading the field — `fs-mock` requires none.
- Authoring docs for plugin authors.

## Repo state after the PR

```
boozy-captain/
├─ apps/
│  └─ web-static/
│     ├─ package.json
│     ├─ index.html
│     ├─ vite.config.ts
│     ├─ tsconfig.json
│     └─ src/
│        ├─ main.tsx          # boots; statically registers fs-mock; renders <App/>
│        └─ App.tsx           # imports Panel from @bc/ui-rn
├─ packages/
│  ├─ core/
│  │  ├─ package.json
│  │  └─ src/
│  │     ├─ index.ts
│  │     ├─ capabilities.ts   # Capability type, host capability set
│  │     ├─ commands.ts       # CommandRegistry (minimal)
│  │     └─ pausable.ts       # pausable(iter) wrapper
│  ├─ vfs/
│  │  ├─ package.json
│  │  └─ src/
│  │     ├─ index.ts
│  │     ├─ types.ts          # Uri, Stat, FsPlugin
│  │     ├─ uri.ts            # parse / build / join helpers
│  │     └─ registry.ts       # scheme → FsPlugin lookup, list()/stat() dispatch
│  ├─ plugin-host/
│  │  ├─ package.json
│  │  └─ src/
│  │     ├─ index.ts
│  │     ├─ manifest.ts       # zod schema for package.json#boozy
│  │     └─ register.ts       # registerStatic(plugin) — calls activate(host)
│  └─ ui-rn/
│     ├─ package.json
│     └─ src/
│        ├─ index.ts
│        ├─ Panel.tsx         # consumes AsyncIterable<Stat>, renders rows
│        └─ PathBar.tsx       # shows current URI, editable
├─ plugins/
│  └─ fs-mock/
│     ├─ package.json         # name: @bc/fs-mock; boozy: { scheme: "mock", requires: [] }
│     └─ src/
│        ├─ index.ts          # exports activate(host)
│        ├─ fixtures.ts       # hardcoded tree
│        └─ fs.ts             # AsyncIterable-based list/stat/read
├─ .yarnrc.yml                # nodeLinker: node-modules
├─ package.json               # workspaces, scripts
├─ turbo.json
├─ tsconfig.base.json
└─ yarn.lock
```

Package names use the `@bc/*` scope. It's a private scope (Verdaccio later); no npm publish in this PR.

## Step-by-step

Recommended order. Each step is independently verifiable.

### 1 — Wipe the existing stub

Delete (the current code is non-functional scaffolding):
- `src/`
- `index.ts`
- `app.json`
- `package-lock.json`
- `.expo/`
- `assets/` *(keep if there's anything we want; otherwise drop)*
- `node_modules/`

Keep `.gitignore`, `tsconfig.json` (rename to `tsconfig.base.json` and rewrite minimal), `.git`, `docs/`.

### 2 — Workspace root

Write at the root:
- `package.json` — `private: true`, `workspaces: ["apps/*", "packages/*", "plugins/*"]`, scripts `dev`, `build`, `typecheck`, `lint`, `test` all delegating to `turbo run …`.
- `.yarnrc.yml` — `nodeLinker: node-modules`, recommended Yarn version pinned.
- `turbo.json` — pipelines for `dev`, `build`, `typecheck`, `lint`, `test` with appropriate `dependsOn`.
- `tsconfig.base.json` — `strict`, `moduleResolution: bundler`, paths intentionally **not** mapped (workspace deps resolve via real `node_modules`).
- ESLint + Prettier config at root, minimal — TypeScript + React rules.

### 3 — `@bc/core`

Smallest content that compiles and is used:
- `Capability` type (string union of the values listed in `architecture.md` §7.2).
- `HostCapabilities` — set, plus `has(c)` helper.
- `CommandRegistry` — `register`, `run`, `list` (no UI binding yet; just to prove the seam).
- `pausable(iter)` — wraps an `AsyncIterable<T>` and exposes `pause()` / `resume()` / `cancel()`. Used by `Panel`.

### 4 — `@bc/vfs`

- `Uri = string`, with `parseUri(uri)` and `joinUri(uri, segment)` helpers. No archive composition yet (`!/` parsing skipped).
- `Stat` type per `features-plan.md` §7.3, minimum fields: `name`, `uri`, `kind`, `size`, `mtime`.
- `FsPlugin` interface, minimal: `scheme`, `capabilities`, `list(uri)`, `stat(uri)`. (`read` declared optional, unused in this PR.)
- `VfsRegistry` — `register(plugin)`, `list(uri)`, `stat(uri)` that dispatch by scheme.

### 5 — `@bc/plugin-host`

- `manifest.ts` — zod schema for the `boozy` field: `{ scheme?: string, capabilities?: Capability[], requires?: Capability[] }`.
- `registerStatic(host, pluginModule)` — reads `package.json#boozy` (via build-time import), intersects `requires` against the host's capability set, calls `pluginModule.activate(host)`.
- `HostApi` minimal: `vfs.register(fsPlugin)`. Nothing else needed in this PR.

### 6 — `@bc/fs-mock`

- `fixtures.ts` — exports a frozen tree:
  ```
  mock:///                → home/, etc/, readme.txt
  mock:///home            → user/
  mock:///home/user       → docs/, photos/, todo.md
  mock:///home/user/docs  → spec.md, notes.txt
  ```
- `fs.ts` — implements `FsPlugin`:
  - `list(uri)` is an async generator that yields each child with a 50 ms delay (configurable; the delay is what makes the streaming visible during dev).
  - `stat(uri)` walks the fixture tree.
- `index.ts` — exports `activate(host)` which calls `host.vfs.register(new MockFs())`.
- `package.json#boozy` — `{ scheme: "mock", requires: [] }`.

### 7 — `@bc/ui-rn`

Components, RN-Web compatible (use `View`, `Text`, `Pressable`):
- `Panel` — props: `{ uri: Uri; onNavigate(uri: Uri): void }`. Internally uses `useDirectoryStream(uri)` (a hook in this package) that wraps `pausable(vfs.list(uri))`, accumulates into state, cancels on unmount.
- `PathBar` — props: `{ uri: Uri; onChange(uri: Uri): void }`. Display-only is fine for v0; editing is a stretch goal of this PR.

### 8 — `apps/web-static`

- Vite + React + react-native-web aliasing (use `vite-plugin-react-native-web` or a hand-rolled alias in `vite.config.ts`).
- `main.tsx`:
  - Constructs the host with capability set `[]` (mock needs nothing).
  - `registerStatic(host, fsMockModule)`.
  - Renders `<App vfs={host.vfs}/>`.
- `App.tsx`:
  - Holds a `currentUri` state initialized to `mock:///`.
  - Renders `<PathBar/>` + `<Panel uri={currentUri} onNavigate={setCurrentUri}/>` + a refresh button.
- `index.html` — minimal Vite template.

### 9 — Smoke test

In `plugins/fs-mock/src/fs.test.ts`:
- Iterate `list('mock:///')`, assert the expected names and count.
- Use `vitest` with the `node` environment.

### 10 — Wire scripts

Root `package.json`:
```
"scripts": {
  "dev":       "turbo run dev --parallel",
  "build":     "turbo run build",
  "typecheck": "turbo run typecheck",
  "lint":      "turbo run lint",
  "test":      "turbo run test"
}
```
`apps/web-static/package.json` `dev` = `vite`, `build` = `vite build`, `typecheck` = `tsc --noEmit`.
Packages export `typecheck` = `tsc --noEmit` and `build` (where applicable) producing `dist/`.

## Risks and watch-outs

- **`vite-plugin-react-native-web` config** can be finicky around Flow types in some RN deps. If it fights us, the fallback is a tiny hand-rolled alias from `react-native` → `react-native-web` in `vite.config.ts` and a `define` for `__DEV__`. We don't need Reanimated, Skia, or any heavy RN lib for this PR.
- **Async iterator pause** — `pausable` is implemented in this PR but not exercised by user interaction; the F3 lister scenario comes later. Make sure it has unit coverage even if the UI never calls `pause()` yet.
- **`package.json#boozy` reading at build time** — we just `import pluginPkg from "@bc/fs-mock/package.json"`. Vite handles this. When Module Federation lands (Phase 2) the runtime path will fetch the manifest from a tgz instead.
- **Yarn Berry first-time setup on Windows** — make sure `corepack enable` is in the contributor docs; users may have stale Yarn 1.

## Follow-up PRs (immediately after the skeleton)

In rough order, each strictly additive:
1. **Second panel + focus switch.** No new packages.
2. **TC-default hotkeys (F1–F10 stubs).** Wires `CommandRegistry` to a `FKeyBar` in `ui-rn`.
3. **`lister-text` plugin + F3.** Proves the second plugin category and exercises `ReadableStream<Uint8Array>` end-to-end.
4. **`fs-fsa` plugin.** First real FS; introduces the permission flow.
5. **Module Federation spike.** Standalone proof, separate apps `apps/vite-host` + a dynamically loaded copy of `fs-mock`. Only after the above are stable.

## Open questions (answer during the PR review)

- Vite version pin? (Recommend latest stable at PR time.)
- ESLint config — flat config or legacy `.eslintrc`? (Recommend flat.)
- Do we adopt `changesets` now, or wait until we publish anything? (Recommend wait.)
- Where does Verdaccio config live in the repo — `docker-compose.yml` at root, or a `tools/verdaccio` dir? (Out of scope for this PR; defer.)
