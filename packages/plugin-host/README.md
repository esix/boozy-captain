# @bc/plugin-host

Loads plugins, validates their manifests, and gates them by capability.

**Exports**
- `HostApi` — what a plugin receives in `activate(host)`: `capabilities`, `vfs`, `surfaces`.
- `createHost({ capabilities, surfaces })` — builds an empty host ready for plugin registration.
- `parseManifest`, `bcManifestSchema` — zod schema for the `boozy`/`bc` field in a plugin's `package.json` ([ADR-0004](../../docs/adr/0004-plugins-as-npm-packages.md)).
- `registerStatic(host, pkg)` — load a plugin bundled at build time; returns `{ status: "activated" | "disabled", reason? }` so a missing capability never silently fails.

Runtime (Module Federation) loading is a separate code path coming in Phase 2 ([ADR-0005](../../docs/adr/0005-module-federation-for-runtime-plugins.md)).
