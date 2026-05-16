# @bc/ui-rn

React Native + RN-Web components for the file-manager chrome. The visual identity of the app, modeled on Total Commander's classic light theme.

**Exports**
- `Panel`, `TwoPanelLayout`, `PathBar` — the file-list surface and its layout.
- `FKeyBar`, `DEFAULT_FKEY_ACTIONS` — TC-style bottom F-key strip (`F3 View · F4 Edit · F5 Copy · F6 RenMov · F7 NewFolder · F8 Delete · Alt+F4 Exit`).
- `CommandLine` — bottom input with `prompt>` prefix, up/down history.
- `tcTheme` — palette and font tokens (Segoe UI / Consolas, TC colors).
- `useDirectoryStream(vfs, uri)` — React hook around `VfsRegistry.list`; accumulates entries from `AsyncIterable<Stat>` with cancellation on unmount.
- `useGlobalHotkeys({ map, registry, enabled })` — `window.keydown` binding to a `CommandRegistry`; auto-skips while typing in inputs.

A `@bc/ui-html` sibling exists for screens where RN-Web underperforms ([ADR-0002](../../docs/adr/0002-rn-web-with-html-escape-hatch.md)).
