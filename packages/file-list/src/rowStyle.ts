import { tcTheme } from "@bc/theme";

export const ROW_HEIGHT = 15;

export interface RowColors {
  bg: string;
  text: string;
  /** CSS outline colour for web rendering ("none" → no outline). Layout-safe. */
  outline: string;
}

export function rowColors(opts: {
  isCursor: boolean;
  focused: boolean;
  marked: boolean;
  hidden: boolean;
}): RowColors {
  const { isCursor, focused, marked } = opts;
  let bg: string = "transparent";
  let text: string = tcTheme.color.text;
  let outline: string = "none";
  // Cursor is only visually shown on the focused panel — TC behavior.
  if (isCursor && focused) {
    bg = tcTheme.color.cursorBg;
    text = tcTheme.color.cursorText;
    outline = tcTheme.color.cursorBorder;
  }
  // Marked rows render red (TC's default selection color) — overrides cursor
  // text color so a marked row stays visibly red even when the cursor is on
  // it. Hidden flag never changes color.
  if (marked) text = tcTheme.color.textMarked;
  return { bg, text, outline };
}

export function splitName(raw: string, isDir: boolean): { displayName: string; ext: string } {
  if (isDir) return { displayName: `[${raw}]`, ext: "" };
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return { displayName: raw, ext: "" };
  return { displayName: raw.slice(0, dot), ext: raw.slice(dot + 1) };
}

export function formatSize(n: number): string {
  if (n < 1024) return `${n} b`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} k`;
  return `${(n / 1024 / 1024).toFixed(1)} M`;
}

export function formatDate(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number): string => n.toString().padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * TC-style attribute string: `a`/`-`, `r`/`-`, `h`/`-`, `s`/`-` — corresponds to
 * archive / read-only / hidden / system. Directories show `----`. We synthesize
 * from the limited Stat we have today (hidden + exec → not real attrs but useful).
 */
export function formatAttr(opts: { kind: string; hidden?: boolean; exec?: boolean }): string {
  if (opts.kind === "dir") return "----";
  const a = opts.exec ? "a" : "-";
  const r = "-";
  const h = opts.hidden ? "h" : "-";
  const s = "-";
  return `${a}${r}${h}${s}`;
}
