import { useCallback, useEffect, useRef, useState } from "react";
import type { Uri } from "@bc/vfs";

/**
 * TC-style left-button file drag-and-drop, web (DOM) implementation.
 *
 * Why pointer-based rather than HTML5 DnD: it mirrors the existing
 * right-button drag-select (document-level mouse listeners + elementFromPoint
 * hit-testing) and gives us full control over the drop-target highlight. Drop
 * effect feedback uses CSS cursors (`copy` / `move` / `alias` / `not-allowed`).
 *
 * Cross-panel coordination lives here (not in Panel) because a drag started in
 * one panel can drop in the other; `elementFromPoint` sees the whole document,
 * so a single set of listeners resolves targets in either panel via DOM data
 * attributes:
 *   - panel root:  data-panel-index, data-panel-dir
 *   - file rows:   data-drop-uri, data-drop-kind ("dir" | "file")
 */

export interface FileDragItem {
  uri: Uri;
  name: string;
  isDir: boolean;
}

export interface FileDragPayload {
  sourcePanel: number;
  sourceDir: Uri;
  items: FileDragItem[];
  /** URIs of all dragged items — used to forbid dropping into a dragged dir. */
  itemUris: ReadonlySet<Uri>;
}

export type DropEffect = "copy" | "move" | "link";

export interface FileDropDescriptor {
  effect: DropEffect;
  items: FileDragItem[];
  sourceDir: Uri;
  targetDir: Uri;
  targetPanel: number;
}

export interface DropTargetState {
  panelIndex: number;
  /** Directory row to outline (null = empty space / file row, no row highlight). */
  highlightUri: Uri | null;
  effect: DropEffect;
  valid: boolean;
}

export interface FileDragController {
  /** Begin a drag with the given payload. Installs the global listeners. */
  begin: (payload: FileDragPayload) => void;
  /** Current resolved drop target (null when not dragging / outside panels). */
  readonly dropTarget: DropTargetState | null;
  /** True while a drag is in progress. */
  readonly active: boolean;
}

interface Modifiers {
  alt: boolean;
  shift: boolean;
  ctrl: boolean;
}

function effectFromModifiers(m: Modifiers): DropEffect {
  // TC bindings: Ctrl+Shift = link, Alt or Shift = move, otherwise copy.
  if (m.ctrl && m.shift) return "link";
  if (m.alt || m.shift) return "move";
  return "copy";
}

function cursorFor(target: DropTargetState | null): string {
  if (!target) return "no-drop";
  if (!target.valid) return "not-allowed";
  switch (target.effect) {
    case "copy":
      return "copy";
    case "move":
      return "move";
    case "link":
      return "alias";
  }
}

// Force the drag cursor across the whole document. Setting body.style.cursor
// alone doesn't win against descendants with their own `cursor` (file rows
// use `cursor: default`), so we toggle a class + CSS var that an !important
// rule in index.html applies to every element. See `html.bc-dragging`.
const DRAG_CLASS = "bc-dragging";
const DRAG_CURSOR_VAR = "--bc-drag-cursor";

function setDragCursor(value: string): void {
  const root = document.documentElement;
  root.classList.add(DRAG_CLASS);
  root.style.setProperty(DRAG_CURSOR_VAR, value);
}

function clearDragCursor(): void {
  const root = document.documentElement;
  root.classList.remove(DRAG_CLASS);
  root.style.removeProperty(DRAG_CURSOR_VAR);
}

interface ResolvedPanel {
  index: number;
  dir: Uri;
}

function resolvePanel(el: Element | null): ResolvedPanel | null {
  if (!(el instanceof HTMLElement)) return null;
  const panelEl = el.closest("[data-panel-index]") as HTMLElement | null;
  if (!panelEl) return null;
  const idx = parseInt(panelEl.dataset.panelIndex ?? "", 10);
  const dir = panelEl.dataset.panelDir;
  if (!Number.isFinite(idx) || dir === undefined) return null;
  return { index: idx, dir };
}

interface ResolvedRow {
  uri: Uri;
  isDir: boolean;
}

function resolveRow(el: Element | null): ResolvedRow | null {
  if (!(el instanceof HTMLElement)) return null;
  const rowEl = el.closest("[data-drop-uri]") as HTMLElement | null;
  if (!rowEl) return null;
  const uri = rowEl.dataset.dropUri;
  if (uri === undefined) return null;
  return { uri, isDir: rowEl.dataset.dropKind === "dir" };
}

export function useFileDrag(onDrop: (d: FileDropDescriptor) => void): FileDragController {
  const [dropTarget, setDropTarget] = useState<DropTargetState | null>(null);
  const [active, setActive] = useState(false);

  const payloadRef = useRef<FileDragPayload | null>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  // Latest target in a ref so the stable `end` callback can read it without
  // re-subscribing the listeners on every target change.
  const lastTargetRef = useRef<DropTargetState | null>(null);
  lastTargetRef.current = dropTarget;
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  // Compute the drop target for a point + modifier state, and push it to React
  // state + the body cursor. Pure resolution lives in the helpers above.
  const recompute = useCallback((x: number, y: number, mods: Modifiers): void => {
    const payload = payloadRef.current;
    if (!payload) return;
    const el = document.elementFromPoint(x, y);
    const panel = resolvePanel(el);
    let next: DropTargetState | null;
    if (!panel) {
      next = null; // outside all panels
    } else {
      const row = resolveRow(el);
      const overDir = row?.isDir === true;
      const targetDir = overDir ? row!.uri : panel.dir;
      const highlightUri = overDir ? row!.uri : null;
      const effect = effectFromModifiers(mods);

      let valid: boolean;
      if (panel.index !== payload.sourcePanel) {
        // Cross-panel: TC always permits the drop and validates at execution
        // (e.g. dir-into-its-own-twin errors only after the copy dialog).
        valid = true;
      } else if (overDir && !payload.itemUris.has(row!.uri)) {
        // Same panel, dropping into a different subdirectory (or [..]).
        valid = true;
      } else {
        // Same panel onto a file / empty space (== source dir, no-op) or onto
        // a dragged directory itself.
        valid = false;
      }
      next = { panelIndex: panel.index, highlightUri, effect, valid };
    }
    setDragCursor(cursorFor(next));
    setDropTarget((prev) => (sameTarget(prev, next) ? prev : next));
  }, []);

  const end = useCallback((commit: boolean): void => {
    const payload = payloadRef.current;
    const target = lastTargetRef.current;
    payloadRef.current = null;
    lastPointRef.current = null;
    lastTargetRef.current = null;
    clearDragCursor();
    setActive(false);
    setDropTarget(null);
    if (commit && payload && target && target.valid) {
      const panelEl = document.querySelector(
        `[data-panel-index="${target.panelIndex}"]`,
      ) as HTMLElement | null;
      const targetDir = target.highlightUri ?? panelEl?.dataset.panelDir ?? payload.sourceDir;
      onDropRef.current({
        effect: target.effect,
        items: payload.items,
        sourceDir: payload.sourceDir,
        targetDir,
        targetPanel: target.panelIndex,
      });
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    const modsFrom = (e: { altKey: boolean; shiftKey: boolean; ctrlKey: boolean }): Modifiers => ({
      alt: e.altKey,
      shift: e.shiftKey,
      ctrl: e.ctrlKey,
    });
    const onMove = (e: MouseEvent): void => {
      lastPointRef.current = { x: e.clientX, y: e.clientY };
      recompute(e.clientX, e.clientY, modsFrom(e));
    };
    const onUp = (e: MouseEvent): void => {
      if (e.button !== 0) return;
      end(true);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        e.preventDefault();
        end(false);
        return;
      }
      // Alt/Shift/Ctrl pressed or released → recompute effect at last point.
      const p = lastPointRef.current;
      if (p) recompute(p.x, p.y, modsFrom(e));
    };
    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("mouseup", onUp, true);
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("keyup", onKey, true);
    return () => {
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("mouseup", onUp, true);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("keyup", onKey, true);
    };
  }, [active, recompute, end]);

  const begin = useCallback((payload: FileDragPayload): void => {
    payloadRef.current = payload;
    setActive(true);
    setDropTarget(null);
    setDragCursor("no-drop");
  }, []);

  return { begin, dropTarget, active };
}

function sameTarget(a: DropTargetState | null, b: DropTargetState | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.panelIndex === b.panelIndex &&
    a.highlightUri === b.highlightUri &&
    a.effect === b.effect &&
    a.valid === b.valid
  );
}
