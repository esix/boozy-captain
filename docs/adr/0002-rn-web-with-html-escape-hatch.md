# ADR-0002: React Native Web as universal UI, with HTML escape hatch

- **Status:** Accepted
- **Date:** 2026-05-15

## Context

The product targets web (static and client-server), Electron desktop, Expo mobile, an experimental terminal renderer, and an XUL renderer. Writing the UI twice (or N times) is a non-starter — but a 2-panel file manager is also a dense desktop UI with virtualized grids, multi-select, drag-and-drop, and column resize. Pure RN-Web is known to struggle at the edges of that envelope.

## Decision

Use **React Native + react-native-web** as the universal UI layer (`@bc/ui-rn`). Where RN-Web becomes a real bottleneck for a desktop-grade interaction, provide an HTML-native equivalent in **`@bc/ui-html`**, shipped via the **Vite host app** (T4) and selectable at app level by swapping the import.

The two packages export the **same component names and props** so apps switch the layer, not the code.

## Consequences

- One component tree covers iOS, Android, web, Electron, terminal (via `rn-terminal`), and XUL adapters. New target = new renderer adapter, not new UI.
- We absorb RN-Web's quirks (style subset, View/Text-only primitives, layout perf on dense lists). Acceptable for most screens.
- Mobile-specific UX (gestures, sheets) lives in `ui-rn` and is no-op on desktop builds.
- `ui-html` is a documented escape hatch — *not* a parallel UI to maintain by default. We add an HTML variant only when the RN-Web version proves insufficient.
- Two implementations of the same component is real maintenance cost; we'll keep `ui-html` minimal and out of mobile/RN-only builds.

## Alternatives

- **Pure RN, web ignored.** Wrong product shape; the file manager needs a strong web story.
- **Pure HTML/React, no RN.** Forces a second codebase for mobile.
- **Tamagui or other compile-time universal libraries.** Promising but adds a build-time toolchain and a learning tax across plugins. Revisit if RN-Web becomes painful broadly, not in isolated screens.
- **Two full UI codebases (RN + HTML).** Tempting on day one, expensive on day 30.
