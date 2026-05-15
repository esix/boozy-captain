# ADR-0004: Plugins are plain npm packages

- **Status:** Accepted
- **Date:** 2026-05-15

## Context

The platform is plugin-driven (FS, listers, editors, archivers, commands). We need a format for plugin authors that's easy to write, easy to publish, easy to install, and easy to validate. Common patterns are: custom JSON manifest + bespoke loader (VS Code style), zip bundle (Chrome extensions), Module Federation remote only, or plain npm package.

We also need a story for distribution — workspace deps in dev, something fetchable at runtime in prod.

## Decision

Plugins are **regular npm packages**. `package.json` is the manifest; Boozy-specific metadata lives under a `"boozy"` field (required capabilities, contributed schemes/listers/commands, MF remote entry name). `@bc/plugin-host` validates the `boozy` field with zod at load time.

Distribution:

- **Develop**: workspace package, depended on via `workspace:*`.
- **Publish**: `yarn build && npm pack` → `.tgz` → push to a registry. Default registry is a **self-hosted Verdaccio**; public npm is optional for OSS plugins.
- **Static install** (MVP, all targets): app declares plugin as a dependency, bundler picks it up.
- **Runtime install** (Phase 2, web-family targets): host fetches the tgz from the registry (or the co-published MF remote) and registers it.

## Consequences

- Plugin authors use a toolchain they already know: `npm init`, `npm pack`, `npm publish`. No bespoke CLI.
- Standard npm semantics give us versioning, peer dependencies, semver ranges, and changelogs for free.
- Verdaccio gives us a private registry without locking us out of the public one — first-party plugins stay private, OSS plugins can be on npm.
- `package.json#boozy` keeps Boozy metadata out of root fields, so npm/Yarn tooling stays oblivious.
- Runtime install becomes "fetch tgz + register MF remote" — boring, well-understood building blocks.
- We accept the tax that plugin packages carry npm's whole metadata surface even when most of it is unused.

## Alternatives

- **Custom JSON manifest + bespoke bundle format.** More control, more code, no upside over npm for our needs.
- **Module Federation remote only, no npm package.** Loses workspace dev ergonomics and the static-install path (which we need for RN/terminal targets that can't load MF remotes).
- **Public npm only.** Fine for OSS but bad for private/first-party plugins and for proof-of-concept iteration. Verdaccio is cheap and removes that constraint.
- **Tarballs without a registry.** Doable, but reinvents `npm install` poorly.
