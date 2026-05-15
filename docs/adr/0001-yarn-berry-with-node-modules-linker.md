# ADR-0001: Yarn Berry with `node_modules` linker

- **Status:** Accepted
- **Date:** 2026-05-15

## Context

We need a package manager for a Turborepo monorepo that ships across web, Electron, Expo (Metro), Vite + Module Federation, and an experimental terminal renderer. The choices in practice are npm workspaces, Yarn (Classic or Berry), and pnpm.

Constraints that matter:

- **Metro and Module Federation require a real, flat `node_modules`** tree. Both follow Node-style resolution and break on virtualized layouts.
- React Native native modules ship postinstall scripts and bundled `android/`, `ios/` folders that expect their package to exist on disk.
- We want strict workspace protocols (`workspace:*`) and modern features (constraints, plugins, deduplication).
- Disk efficiency matters but is secondary.

## Decision

Use **Yarn Berry (v3/v4)** with `nodeLinker: node-modules` in `.yarnrc.yml`. **Yarn PnP is explicitly off.**

## Consequences

- Real `node_modules` keeps Metro, Expo, React Native, Electron, and Module Federation happy with zero adapter work.
- We get modern Yarn ergonomics: `workspace:*`, `yarn constraints`, plugins, deterministic installs.
- Disk usage is higher than pnpm. Acceptable cost.
- Resolution is lenient (no phantom-dep errors); we'll lean on TypeScript and lint to catch missing dependency declarations.
- `yarn.lock` is committed; Berry's zero-installs feature is left off until we have evidence it's worth the repo size.

## Alternatives

- **pnpm.** Better disk usage and strict resolution, but its symlinked store has historically caused friction with RN/Metro and with some Module Federation setups. The friction isn't worth the gain for this project.
- **Yarn PnP.** Modern and elegant on greenfield Node code, but a hard "no" for RN/Expo and a partial "no" for Module Federation. Off the table.
- **Yarn Classic (v1).** Works, but no `workspace:*` protocol, no constraints, no plugins, on maintenance mode.
- **npm workspaces.** Adequate but lacks the workspace tooling we want; Turborepo works equally well with it if we change our mind later.
