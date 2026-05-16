# @bc/core

Platform-agnostic primitives shared by every other package. Zero UI deps.

**Exports**
- `Capability`, `HostCapabilities` — capability vocabulary and host-side gate ([ADR-0006](../../docs/adr/0006-capability-based-plugin-gating.md)).
- `Command`, `CommandRegistry` — id-addressed actions bound by hotkeys, menus, and the F-key bar.
- `Hotkey`, `HotkeyMap`, `normalizeCombo`, `eventMatches` — platform-agnostic key-combo model.
- `Pausable`, `pausable(iter)` — wrap any `AsyncIterable<T>` with explicit `pause()` / `resume()` / `cancel()`. Used wherever a consumer can't simply stop awaiting ([ADR-0003](../../docs/adr/0003-pull-based-streams.md)).
