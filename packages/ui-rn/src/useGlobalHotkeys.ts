import { useEffect } from "react";
import {
  type CommandRegistry,
  type HotkeyMap,
  eventMatches,
  normalizeCombo,
} from "@bc/core";

interface UseGlobalHotkeysOpts {
  map: HotkeyMap;
  registry: CommandRegistry;
  /** When false, the listener is not attached. Default: true. */
  enabled?: boolean;
  /** Skip when this returns true. Used to disable bindings while typing in inputs. */
  shouldSkip?: (target: EventTarget | null) => boolean;
  /** Optional context passed to commands. */
  getContext?: () => unknown;
  /** preventDefault on match. Default: true. */
  preventDefault?: boolean;
}

/**
 * Binds global keyboard shortcuts on `window`. Web-only — native RN platforms
 * will need their own hook (RNTV remote, etc.).
 */
export function useGlobalHotkeys({
  map,
  registry,
  enabled = true,
  shouldSkip = defaultShouldSkip,
  getContext,
  preventDefault = true,
}: UseGlobalHotkeysOpts): void {
  useEffect(() => {
    if (!enabled) return;
    const entries = Object.entries(map).map(([combo, cmd]) => ({
      combo: normalizeCombo(combo),
      cmd,
    }));
    const handler = (e: KeyboardEvent): void => {
      if (shouldSkip(e.target)) return;
      for (const { combo, cmd } of entries) {
        if (eventMatches(e, combo)) {
          if (preventDefault) e.preventDefault();
          void registry.run(cmd, getContext?.());
          return;
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [map, registry, enabled, shouldSkip, getContext, preventDefault]);
}

function defaultShouldSkip(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}
