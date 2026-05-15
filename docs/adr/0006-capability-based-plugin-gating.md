# ADR-0006: Capability-based plugin gating

- **Status:** Accepted
- **Date:** 2026-05-15

## Context

Different build targets have different runtime powers — a browser-pure build can't spawn processes, an Android build has SAF but no `node:fs`, a terminal build has TTY but no DOM. A naive plugin (e.g. `fs-node`) loaded into a browser shell would fail mysteriously at first use. We need a way to decide *before activation* whether a plugin can run, with a clear human-readable reason when it can't.

Two main approaches: target tags (`requires: ["electron","node"]`) or capability tags (`requires: ["fs.write","process.spawn"]`).

## Decision

Use **capability tags**, not target tags. The host advertises a capability set on boot. Each plugin declares `requires` in its `package.json#boozy`. `@bc/plugin-host` intersects the two before calling `activate()`. Mismatches go to a "disabled plugins" UI with the missing capability listed.

Capability vocabulary (initial):

- FS: `fs.read`, `fs.write`, `fs.watch`, `fs.symlink`, `fs.permissions`
- Net: `net.fetch`, `net.stream`, `net.ws`
- Process: `process.spawn`, `process.tty`
- Misc: `clipboard.read`, `clipboard.write`, `dialog.native`, `crypto.subtle`, `storage.persistent`

The vocabulary is owned by `@bc/core`. New capabilities require a doc note here.

## Consequences

- Plugins target *what they need to do*, not *what shell exists*. `fs-webdav` works on every shell with `net.fetch`, automatically.
- Adding a new build target (e.g., XUL) is a matter of declaring its capability set; existing plugins activate based on that set without code changes.
- Runtime-loaded plugins must surface their requested capabilities to the user before activation — capabilities are also the basis of the user-facing permission UI.
- We pay a small upfront cost: maintaining the vocabulary and keeping shells honest about what they expose. Worth it.
- Capability *claims* are honor-system in MVP — a plugin can technically reach beyond what it declared (no real sandbox). ADR-0010 covers the v2 hardening (Worker realm).

## Alternatives

- **Target tags (`requires: ["electron"]`).** Brittle. Every new target needs every plugin to be updated. Doesn't help with the permission UI.
- **No gating; let plugins fail at runtime.** Awful UX, hard to debug.
- **Permissions inferred at runtime (no declaration).** No way to refuse incompatible plugins up-front; no permission prompt.
