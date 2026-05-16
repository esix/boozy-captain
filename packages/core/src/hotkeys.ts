/**
 * Hotkey representation, platform-agnostic.
 *
 * Format: `[Modifier+]*Key`
 *   - Modifiers (in any order, lowercase ok): Ctrl, Alt, Shift, Meta
 *   - Key: any DOM KeyboardEvent.key value (`F3`, `ArrowUp`, ` ` for space,
 *     `Enter`, `Tab`, `Insert`, `Home`, `End`, `PageUp`, `PageDown`,
 *     printable chars `a`-`z`, etc.)
 *
 * Examples: `F3`, `Ctrl+C`, `Shift+Tab`, `Alt+F4`, `Space`, ` ` (literal space).
 *
 * Note: `Space` and `' '` are both accepted and normalize to the same combo.
 */
export type Hotkey = string;

export interface HotkeyMap {
  /** Combo → command id (registered in CommandRegistry). */
  [combo: string]: string;
}

export interface NormalizedCombo {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
  key: string; // lowercased
}

export function normalizeCombo(combo: Hotkey): NormalizedCombo {
  const parts = combo.split("+").map((p) => p.trim());
  let ctrl = false,
    alt = false,
    shift = false,
    meta = false;
  let key = "";
  for (const p of parts) {
    const lower = p.toLowerCase();
    if (lower === "ctrl" || lower === "control") ctrl = true;
    else if (lower === "alt" || lower === "option") alt = true;
    else if (lower === "shift") shift = true;
    else if (lower === "meta" || lower === "cmd" || lower === "command") meta = true;
    else key = lower;
  }
  if (key === "space") key = " ";
  return { ctrl, alt, shift, meta, key };
}

export function comboKey(c: NormalizedCombo): string {
  return [
    c.ctrl ? "c" : "",
    c.alt ? "a" : "",
    c.shift ? "s" : "",
    c.meta ? "m" : "",
    "|",
    c.key,
  ].join("");
}

export function eventMatches(
  ev: { key: string; ctrlKey: boolean; altKey: boolean; shiftKey: boolean; metaKey: boolean },
  c: NormalizedCombo,
): boolean {
  return (
    ev.key.toLowerCase() === c.key &&
    ev.ctrlKey === c.ctrl &&
    ev.altKey === c.alt &&
    ev.shiftKey === c.shift &&
    ev.metaKey === c.meta
  );
}
