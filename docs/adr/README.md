# Architecture Decision Records

This directory contains ADRs — short records of decisions that shape the architecture, capturing **why** we chose what we chose. Future contributors should read these before re-litigating a decision.

> **ADR numbers are chronological identifiers, not a priority ranking.** ADR-0008 isn't less important than ADR-0001; it just landed later. The **★** column marks ADRs that are especially load-bearing — changes here ripple through everything else.

## Format

We use the Michael Nygard template, trimmed:

- **Status** — Proposed / Accepted / Superseded by ADR-XXXX
- **Context** — what forced a decision, what constraints applied
- **Decision** — what we chose
- **Consequences** — what we gain, what we give up, what we'll have to watch
- **Alternatives** — what else we considered and why we passed

One ADR per decision. Don't edit accepted ADRs — supersede them with a new one and link back.

## Index

| # | ★ | Title | Status |
|---|---|---|---|
| [0001](./0001-yarn-berry-with-node-modules-linker.md) |   | Yarn Berry with `node_modules` linker | Accepted |
| [0002](./0002-rn-web-with-html-escape-hatch.md) |   | React Native Web as universal UI, with HTML escape hatch | Accepted |
| [0003](./0003-pull-based-streams.md) | ★ | Pull-based streams as the canonical I/O primitive | Accepted |
| [0004](./0004-plugins-as-npm-packages.md) | ★ | Plugins are plain npm packages | Accepted |
| [0005](./0005-module-federation-for-runtime-plugins.md) |   | Module Federation for runtime plugin loading (web-family only) | Accepted |
| [0006](./0006-capability-based-plugin-gating.md) | ★ | Capability-based plugin gating | Accepted |
| [0007](./0007-uri-addressing-with-archive-composition.md) | ★ | Single URI addressing scheme, archive composition by `!/` | Accepted |
| [0008](./0008-process-surface-decoupling.md) | ★ | Process / Surface decoupling for windowing | Accepted |
| 0009 | | Zustand for state management | _todo_ |
| 0010 | | Sidecar protocol over HTTP + WebSocket for T2 | _todo_ |
| 0011 | | No hard plugin sandbox in MVP; Web Worker realm in v2 | _todo_ |
| 0012 | | Turborepo as the monorepo orchestrator | _todo_ |
| 0013 | | TC keybinding profile as default | _todo_ |
