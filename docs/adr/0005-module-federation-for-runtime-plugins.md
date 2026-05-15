# ADR-0005: Module Federation for runtime plugin loading (web-family only)

- **Status:** Accepted
- **Date:** 2026-05-15

## Context

A core product promise is "install a plugin without redeploying the app." Browser shells can do that natively (dynamic `import()`, MF). React Native (Metro) cannot, in any production-grade way — code-push delivers JS bundles but not the kind of granular, per-plugin remote loading we want. The terminal and XUL renderers are even further from this story.

We have to decide whether runtime loading is supported uniformly (it isn't possible) or per-target (more honest).

## Decision

**Module Federation** is the runtime plugin-loading mechanism for **web-family targets only**:

- T1 web-static, T2 web+node, T3 Electron, T4 Vite host, T9 Win32 (Electron-repacked).

Tooling: a Vite-compatible MF implementation (`@module-federation/vite` or `originjs/vite-plugin-federation` — to be chosen by a spike). Each plugin co-publishes an MF remote alongside its tgz.

**All other targets** (T5 Android, T6 iOS, T7 terminal, T8 XUL) use **static plugin registration only** — plugins are workspace deps bundled at build time.

## Consequences

- The plugin contract is identical on every target. Only the *loading mechanism* differs. A plugin doesn't know whether it was loaded statically or dynamically.
- The plugin compatibility matrix (`features-plan.md` §10) gets a hard column: "Runtime loadable: yes/no" per target. We surface that in the plugin manager UI.
- On mobile and terminal, the "install plugin" UI either redirects to "install plugin in a new app build" or is hidden entirely.
- We accept that Module Federation tooling for Vite is younger than the webpack equivalent. A Phase 0 spike de-risks the choice.
- Runtime loading from a registry (`fetch tgz + register MF remote`) requires a host orchestration layer — that's where capability prompts and per-plugin confirmation live.

## Alternatives

- **SystemJS / import maps.** Workable on web, no MF-specific tooling. Less batteries-included for shared deps; we'd hand-roll dedupe.
- **Custom in-process loader (`eval` / `new Function`).** Removes tooling dependency but loses bundler features (tree-shaking, shared chunks) and complicates capability gating.
- **No runtime loading anywhere.** Simpler, but loses a flagship feature. We'd be just an offline desktop file manager.
- **Uniform runtime loading via codepush on RN.** Not granular enough; not available on terminal/XUL.
