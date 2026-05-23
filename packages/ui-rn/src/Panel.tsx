import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CommandRegistry } from "@bc/core";
import {
  FileList,
  createDefaultRegistry,
  formatAttr,
  formatDate,
  formatSize,
  type FileListView,
  type FileListViewRegistry,
  type Row,
  type SortSpec,
} from "@bc/file-list";
import type { Stat, Uri, VfsRegistry } from "@bc/vfs";
import { parentUri } from "@bc/vfs";
import { DriveBar } from "./DriveBar.js";
import { PathBar } from "./PathBar.js";
import { TabBar, type TabSpec } from "./TabBar.js";
import { tcTheme } from "./theme.js";
import { useDirectoryStream } from "./useDirectoryStream.js";
import { useGlobalHotkeys } from "./useGlobalHotkeys.js";

export interface PanelSelection {
  entries: readonly Stat[];
  cursor: number;
  cursorItem: Stat | null;
  marked: readonly Stat[];
}

export interface PanelTabsProps {
  items: readonly TabSpec[];
  activeId: string;
  onActivate: (id: string) => void;
  onClose?: (id: string) => void;
  onNew?: () => void;
}

export interface PanelProps {
  vfs: VfsRegistry;
  uri: Uri;
  onNavigate: (uri: Uri) => void;
  focused?: boolean;
  onFocus?: () => void;
  onSelectionChange?: (sel: PanelSelection) => void;
  /** Optional registry; defaults to the built-in Brief + Full views. */
  viewRegistry?: FileListViewRegistry;
  /** Current view-mode id (controlled). Defaults to "brief" if not provided. */
  viewId?: string;
  /** Optional tab strip above the panel. Hidden when undefined. */
  tabs?: PanelTabsProps;
  /** Optional free-space line shown in the DriveBar. */
  driveInfo?: string;
  /** Prefix for data-testid attributes on this panel and its children. */
  testID?: string;
  /** Double-click on the panel's empty area triggers this (TC creates a new tab). */
  onCreateTab?: () => void;
}

const PAGE_SIZE = 10;

export function Panel({
  vfs,
  uri,
  onNavigate,
  focused = false,
  onFocus,
  onSelectionChange,
  viewRegistry,
  viewId = "brief",
  tabs,
  driveInfo,
  testID = "bc-panel",
  onCreateTab,
}: PanelProps): JSX.Element {
  const registry = useMemo(() => viewRegistry ?? createDefaultRegistry(), [viewRegistry]);
  const view: FileListView = registry.get(viewId) ?? registry.list()[0]!;

  const { entries, loading, error, reload } = useDirectoryStream(vfs, uri);
  // Cursor identity is a URI (so it follows the file when streaming sort
  // reorders rows). Derived `cursor` index is recomputed each render and is
  // -1 while the URI isn't present in `rows` (e.g. just navigated up and the
  // parent listing is still streaming — show "no row highlighted" rather than
  // flashing on [..] briefly).
  const [cursorUri, setCursorUri] = useState<Uri | null>(() => parentUri(uri));
  const [marked, setMarked] = useState<Set<Uri>>(new Set());
  const [sort, setSort] = useState<SortSpec>({ key: "name", direction: "asc" });
  // Horizontal stride reported by the active view. 0 = no horizontal nav
  // (single-column view); >0 = move cursor by that many indices on Left/Right.
  const [columnStride, setColumnStride] = useState(0);

  // When uri changes, place the cursor sensibly:
  //   - going UP (new uri is parent of previous uri) → cursor lands on the
  //     directory we just left, so the user sees where they came from.
  //   - any other change (down, tab switch, etc.) → cursor on [..].
  const prevUriRef = useRef<Uri>(uri);
  useEffect(() => {
    const prev = prevUriRef.current;
    if (prev !== uri) {
      if (uri === parentUri(prev)) {
        setCursorUri(prev);
      } else {
        setCursorUri(parentUri(uri));
      }
      setMarked(new Set());
    }
    prevUriRef.current = uri;
  }, [uri]);

  // Build rows: synthetic [..] first (omitted at root), then directories
  // (always alphabetical regardless of sort mode), then files sorted per `sort`.
  const rows = useMemo<Row[]>(() => {
    const parent = parentUri(uri);
    const atRoot = parent === uri;
    const dirs: Stat[] = [];
    const files: Stat[] = [];
    for (const e of entries) (e.kind === "dir" ? dirs : files).push(e);
    dirs.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    files.sort((a, b) => compareEntries(a, b, sort));
    const toRow = (stat: Stat): Row => ({ kind: "entry", stat });
    const body = [...dirs.map(toRow), ...files.map(toRow)];
    return atRoot ? body : [{ kind: "parent", uri: parent } satisfies Row, ...body];
  }, [uri, entries, sort]);

  // When the stream finishes and the cursor still hasn't landed on any row
  // (typically at root, where there's no [..] to fall back on), select the
  // first row. Matches TC's behavior of always having one row highlighted.
  //
  // We gate on having actually observed `loading: true` for the current uri,
  // because on uri-change React renders one cycle with the new uri but stale
  // {loading: false, entries: previous-dir} — without the gate we'd briefly
  // see the cursor as "unmatched" against stale rows and override the
  // go-up cursor placement.
  const loadingSeenForUriRef = useRef<Uri | null>(null);
  useEffect(() => {
    if (loading) {
      loadingSeenForUriRef.current = uri;
      return;
    }
    if (loadingSeenForUriRef.current !== uri) return;
    if (rows.length === 0) return;
    if (cursorUri !== null && rows.some((r) => uriOfRow(r) === cursorUri)) return;
    setCursorUri(uriOfRow(rows[0]!));
  }, [loading, rows, cursorUri, uri]);

  // Derive cursor index from cursorUri + current rows. -1 means "no row
  // highlighted" — happens when the chosen URI isn't yet present in rows
  // (streaming, just-navigated-up, etc.). Views render no cursor highlight.
  const cursor = useMemo(() => {
    if (cursorUri === null) return -1;
    return rows.findIndex((r) => uriOfRow(r) === cursorUri);
  }, [cursorUri, rows]);

  // Index-based setter used by views: convert to URI and persist.
  const setCursor = useCallback(
    (idx: number) => {
      const r = rows[idx];
      if (r) setCursorUri(uriOfRow(r));
    },
    [rows],
  );

  const cursorRow: Row | null = rows[cursor] ?? null;
  const cursorItem: Stat | null = cursorRow?.kind === "entry" ? cursorRow.stat : null;

  useEffect(() => {
    onSelectionChange?.({
      entries,
      cursor,
      cursorItem,
      marked: entries.filter((e) => marked.has(e.uri)),
    });
  }, [entries, cursor, cursorItem, marked, onSelectionChange]);

  const footer = useMemo(
    () => computeFooter(entries, marked, cursorRow),
    [entries, marked, cursorRow],
  );

  const navigate = useCallback(
    (next: Uri): void => {
      onFocus?.();
      onNavigate(next);
    },
    [onFocus, onNavigate],
  );

  const activateRow = useCallback(
    (row: Row): void => {
      onFocus?.();
      if (row.kind === "parent") {
        navigate(row.uri);
        return;
      }
      if (row.stat.kind === "dir") navigate(row.stat.uri);
    },
    [navigate, onFocus],
  );

  // Cap the cursor-move rate. OS key auto-repeat fires ~30/sec which is too
  // fast for comfortable visual tracking AND lets several events queue up
  // between renders (resulting in the cursor "jumping" several rows at once
  // when React batches them). Throttling to ~12/sec gives one move per
  // render frame on practically any list size — smooth.
  //
  // First press is always immediate (the ref starts at 0, so the first call
  // is always >MIN_MOVE_MS old). On key release, the ref doesn't reset, but
  // next press will be > 80 ms later, so it goes through.
  const lastMoveAtRef = useRef(0);
  const MIN_MOVE_INTERVAL_MS = 80;

  const moveCursor = useCallback((delta: number): void => {
    const now =
      typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
    if (now - lastMoveAtRef.current < MIN_MOVE_INTERVAL_MS) return;
    lastMoveAtRef.current = now;
    setCursorUri((prevUri) => {
      const rowsNow = rowsRef.current;
      if (rowsNow.length === 0) return prevUri;
      let curIdx = -1;
      if (prevUri !== null) curIdx = rowsNow.findIndex((r) => uriOfRow(r) === prevUri);
      if (curIdx < 0) curIdx = 0;
      const newIdx = clamp(curIdx + delta, 0, rowsNow.length - 1);
      return uriOfRow(rowsNow[newIdx]!);
    });
  }, []);

  const moveCursorTo = useCallback((pos: "start" | "end"): void => {
    setCursorUri(() => {
      const rowsNow = rowsRef.current;
      if (rowsNow.length === 0) return null;
      const idx = pos === "start" ? 0 : rowsNow.length - 1;
      return uriOfRow(rowsNow[idx]!);
    });
  }, []);

  const toggleMarkAt = useCallback(
    (idx: number): void => {
      const row = rows[idx];
      if (!row || row.kind === "parent") return;
      setMarked((prev) => {
        const next = new Set(prev);
        if (next.has(row.stat.uri)) next.delete(row.stat.uri);
        else next.add(row.stat.uri);
        return next;
      });
    },
    [rows],
  );

  const panelRegistry = useMemo(() => {
    const r = new CommandRegistry();
    r.register({ id: "panel.cursorUp", title: "Up", run: () => moveCursor(-1) });
    r.register({ id: "panel.cursorDown", title: "Down", run: () => moveCursor(1) });
    r.register({ id: "panel.cursorPageUp", title: "PgUp", run: () => moveCursor(-PAGE_SIZE) });
    r.register({ id: "panel.cursorPageDown", title: "PgDn", run: () => moveCursor(PAGE_SIZE) });
    r.register({
      id: "panel.cursorLeft",
      title: "Left",
      run: () => moveCursor(columnStride > 0 ? -columnStride : 0),
    });
    r.register({
      id: "panel.cursorRight",
      title: "Right",
      run: () => moveCursor(columnStride > 0 ? columnStride : 0),
    });
    r.register({ id: "panel.cursorHome", title: "Home", run: () => moveCursorTo("start") });
    r.register({ id: "panel.cursorEnd", title: "End", run: () => moveCursorTo("end") });
    r.register({
      id: "panel.activate",
      title: "Enter",
      run: () => {
        if (cursorRow) activateRow(cursorRow);
      },
    });
    r.register({
      id: "panel.up",
      title: "Backspace",
      run: () => navigate(parentUri(uri)),
    });
    r.register({
      id: "panel.toggleMark",
      title: "Space",
      run: () => toggleMarkAt(cursor),
    });
    r.register({
      id: "panel.toggleMarkAndAdvance",
      title: "Insert",
      run: () => {
        toggleMarkAt(cursor);
        moveCursor(1);
      },
    });
    r.register({ id: "panel.reload", title: "Refresh", run: () => reload() });
    return r;
  }, [
    moveCursor,
    moveCursorTo,
    activateRow,
    cursorRow,
    navigate,
    uri,
    toggleMarkAt,
    cursor,
    reload,
    columnStride,
  ]);

  const hotkeyMap = useMemo(
    () => ({
      ArrowUp: "panel.cursorUp",
      ArrowDown: "panel.cursorDown",
      ArrowLeft: "panel.cursorLeft",
      ArrowRight: "panel.cursorRight",
      PageUp: "panel.cursorPageUp",
      PageDown: "panel.cursorPageDown",
      Home: "panel.cursorHome",
      End: "panel.cursorEnd",
      Enter: "panel.activate",
      " ": "panel.toggleMark",
      Insert: "panel.toggleMarkAndAdvance",
      F2: "panel.reload",
    }),
    [],
  );

  useGlobalHotkeys({ map: hotkeyMap, registry: panelRegistry, enabled: focused });

  // Quick search: typing printable chars in the focused panel jumps the cursor
  // to the first row whose name starts with the query. Esc / 1.5s idle resets.
  // Skips while typing in inputs (command line).
  const [quickQuery, setQuickQuery] = useState("");
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!focused) return;
    const handler = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      let nextQuery: string | null = null;
      if (e.key === "Escape") {
        nextQuery = "";
      } else if (e.key === "Backspace") {
        e.preventDefault();
        if (quickQuery.length > 0) {
          nextQuery = quickQuery.slice(0, -1);
        } else {
          // Empty query: Backspace navigates up.
          navigate(parentUri(uri));
          return;
        }
      } else if (e.key.length === 1 && e.key !== " ") {
        nextQuery = (quickQuery + e.key).toLowerCase();
        e.preventDefault();
      }
      if (nextQuery === null) return;
      setQuickQuery(nextQuery);
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => setQuickQuery(""), 1500);
      if (nextQuery.length === 0) return;
      const idx = rows.findIndex((r) => {
        if (r.kind === "parent") return false;
        return r.stat.name.toLowerCase().startsWith(nextQuery!);
      });
      if (idx >= 0) setCursor(idx);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [focused, quickQuery, rows, navigate, uri]);
  useEffect(() => {
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, []);

  const markedUriSet = useMemo(() => new Set(marked), [marked]);

  // ─── TC-style right-button drag selection ────────────────────────────────
  // Mousedown right-button on a row sets the drag mode based on that row's
  // current mark (selected → "unselect"; unselected → "select"). Mousemove
  // applies the same mode to every row under the cursor; already-matching
  // rows are left alone (idempotent). Mouseup ends the drag.
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const markedRef = useRef(marked);
  markedRef.current = marked;
  // Drag-select state: anchor (mousedown row), range = cumulative [lo, hi]
  // touched so far, mode determined at anchor (toggle direction).
  const dragSelectRef = useRef<{
    anchor: number;
    range: { lo: number; hi: number };
    mode: "select" | "unselect";
  } | null>(null);
  const lastMouseRef = useRef<{ x: number; y: number } | null>(null);
  const autoScrollRafRef = useRef<number | null>(null);
  const cachedScrollerRef = useRef<HTMLElement | null>(null);

  const findRowIndex = useCallback(
    (target: EventTarget | null): number => {
      if (!(target instanceof HTMLElement)) return -1;
      // Scope to this panel — drag started in panel A shouldn't mark panel B.
      const panelEl = target.closest(`[data-testid="${testID}"]`);
      if (!panelEl) return -1;
      const rowEl = target.closest("[data-row-index]") as HTMLElement | null;
      if (!rowEl) return -1;
      const n = parseInt(rowEl.dataset.rowIndex ?? "", 10);
      return Number.isFinite(n) ? n : -1;
    },
    [testID],
  );

  // Find the scrollable element inside the panel (BriefView's ScrollView or
  // FullView's FlatList). Cached per drag.
  const findScroller = useCallback((): HTMLElement | null => {
    if (cachedScrollerRef.current && document.contains(cachedScrollerRef.current)) {
      return cachedScrollerRef.current;
    }
    const panelEl = document.querySelector(`[data-testid="${testID}"]`);
    if (!(panelEl instanceof HTMLElement)) return null;
    for (const el of Array.from(panelEl.querySelectorAll<HTMLElement>("*"))) {
      const cs = window.getComputedStyle(el);
      const overflowX = cs.overflowX;
      const overflowY = cs.overflowY;
      const hasOverflowX = (overflowX === "auto" || overflowX === "scroll") && el.scrollWidth > el.clientWidth;
      const hasOverflowY = (overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight;
      if (hasOverflowX || hasOverflowY) {
        cachedScrollerRef.current = el;
        return el;
      }
    }
    return null;
  }, [testID]);

  // Apply mode to every entry row in [lo, hi] inclusive. Idempotent — rows
  // already in the target state are skipped.
  const applyRange = useCallback(
    (lo: number, hi: number, mode: "select" | "unselect") => {
      if (hi < lo) return;
      setMarked((prev) => {
        const next = new Set(prev);
        let changed = false;
        for (let i = lo; i <= hi; i++) {
          const row = rowsRef.current[i];
          if (!row || row.kind === "parent") continue;
          const uriOfThis = row.stat.uri;
          if (mode === "select") {
            if (!next.has(uriOfThis)) {
              next.add(uriOfThis);
              changed = true;
            }
          } else {
            if (next.has(uriOfThis)) {
              next.delete(uriOfThis);
              changed = true;
            }
          }
        }
        return changed ? next : prev;
      });
    },
    [],
  );

  // Extend the active drag's cumulative range to include `idx`. Applies the
  // mode to only the newly-covered rows (the existing range stays as-is, so
  // already-applied rows aren't re-touched).
  const extendRangeTo = useCallback(
    (idx: number) => {
      const d = dragSelectRef.current;
      if (!d) return;
      const newLo = Math.min(d.range.lo, idx);
      const newHi = Math.max(d.range.hi, idx);
      if (newLo === d.range.lo && newHi === d.range.hi) return;
      if (newLo < d.range.lo) applyRange(newLo, d.range.lo - 1, d.mode);
      if (newHi > d.range.hi) applyRange(d.range.hi + 1, newHi, d.mode);
      d.range = { lo: newLo, hi: newHi };
    },
    [applyRange],
  );

  useEffect(() => {
    const EDGE = 30;
    const SPEED = 8;

    const stopAutoScroll = (): void => {
      if (autoScrollRafRef.current !== null) {
        cancelAnimationFrame(autoScrollRafRef.current);
        autoScrollRafRef.current = null;
      }
    };

    // Compute scroll delta from last mouse position relative to panel rect.
    const computeDelta = (
      rect: DOMRect,
    ): { dx: number; dy: number } => {
      const pos = lastMouseRef.current;
      if (!pos) return { dx: 0, dy: 0 };
      let dx = 0;
      let dy = 0;
      if (pos.x < rect.left + EDGE) dx = -SPEED - Math.max(0, rect.left - pos.x);
      else if (pos.x > rect.right - EDGE) dx = SPEED + Math.max(0, pos.x - rect.right);
      if (pos.y < rect.top + EDGE) dy = -SPEED - Math.max(0, rect.top - pos.y);
      else if (pos.y > rect.bottom - EDGE) dy = SPEED + Math.max(0, pos.y - rect.bottom);
      return { dx, dy };
    };

    const tick = (): void => {
      if (!dragSelectRef.current || !lastMouseRef.current) {
        autoScrollRafRef.current = null;
        return;
      }
      const panelEl = document.querySelector(`[data-testid="${testID}"]`);
      if (!(panelEl instanceof HTMLElement)) {
        autoScrollRafRef.current = null;
        return;
      }
      const rect = panelEl.getBoundingClientRect();
      const { dx, dy } = computeDelta(rect);
      if (dx === 0 && dy === 0) {
        autoScrollRafRef.current = null;
        return;
      }
      const scroller = findScroller();
      if (scroller) scroller.scrollBy(dx, dy);

      // After scrolling, the row under the cursor likely changed. Look it up
      // (clamped to inside the panel so an out-of-bounds mouse still resolves
      // to a real row near the edge).
      const pos = lastMouseRef.current;
      const cx = Math.max(rect.left + 2, Math.min(rect.right - 2, pos.x));
      const cy = Math.max(rect.top + 2, Math.min(rect.bottom - 2, pos.y));
      const el = document.elementFromPoint(cx, cy);
      const idx = findRowIndex(el);
      if (idx >= 0) {
        setCursor(idx);
        extendRangeTo(idx);
      }
      autoScrollRafRef.current = requestAnimationFrame(tick);
    };

    const maybeStartAutoScroll = (): void => {
      if (autoScrollRafRef.current !== null) return;
      autoScrollRafRef.current = requestAnimationFrame(tick);
    };

    const onMouseDown = (e: MouseEvent): void => {
      if (e.button !== 2) return;
      const idx = findRowIndex(e.target);
      if (idx < 0) return;
      const row = rowsRef.current[idx];
      if (!row || row.kind === "parent") return;
      e.preventDefault();
      onFocus?.();
      setCursor(idx);
      const mode: "select" | "unselect" = markedRef.current.has(row.stat.uri)
        ? "unselect"
        : "select";
      dragSelectRef.current = { anchor: idx, range: { lo: idx, hi: idx }, mode };
      cachedScrollerRef.current = null; // re-find scroller per drag
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      applyRange(idx, idx, mode);
    };
    const onMouseMove = (e: MouseEvent): void => {
      if (!dragSelectRef.current) return;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      const idx = findRowIndex(e.target);
      if (idx >= 0) {
        setCursor(idx);
        extendRangeTo(idx);
      }
      // Edge → kick off auto-scroll if not already running.
      const panelEl = document.querySelector(`[data-testid="${testID}"]`);
      if (panelEl instanceof HTMLElement) {
        const rect = panelEl.getBoundingClientRect();
        const nearEdge =
          e.clientX < rect.left + EDGE ||
          e.clientX > rect.right - EDGE ||
          e.clientY < rect.top + EDGE ||
          e.clientY > rect.bottom - EDGE;
        if (nearEdge) maybeStartAutoScroll();
      }
    };
    const onMouseUp = (e: MouseEvent): void => {
      if (e.button === 2) {
        dragSelectRef.current = null;
        stopAutoScroll();
      }
    };
    const onContextMenu = (e: MouseEvent): void => {
      // Suppress the browser context menu inside rows (we use right-click for
      // mark / drag-select).
      if (findRowIndex(e.target) >= 0) e.preventDefault();
    };
    document.addEventListener("mousedown", onMouseDown, true);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp, true);
    document.addEventListener("contextmenu", onContextMenu, true);
    return () => {
      document.removeEventListener("mousedown", onMouseDown, true);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp, true);
      document.removeEventListener("contextmenu", onContextMenu, true);
      stopAutoScroll();
    };
  }, [findRowIndex, applyRange, extendRangeTo, setCursor, onFocus, findScroller, testID]);

  // RN-Web's Pressable defaults to tabIndex=0 (role=button) — making it a
  // focus target so Space/Enter pressed afterwards activate the Pressable
  // instead of reaching the panel's keyboard handler. Take it out of the
  // focus order entirely.
  const nonFocusable = {
    tabIndex: -1,
    onMouseDown: (e: { preventDefault(): void }) => e.preventDefault(),
  } as unknown as object;

  // Note: new-tab on double-click lives inside the TabBar's empty area now,
  // not on the whole panel (that was firing on every double-click inside the
  // panel, e.g. the view switcher).
  void onCreateTab;

  return (
    <Pressable
      onPress={onFocus}
      {...nonFocusable}
      style={[styles.container, focused && styles.focused]}
      testID={testID}
    >
      <DriveBar uri={uri} info={driveInfo} onNavigate={navigate} testID={`${testID}-drivebar`} />
      {tabs && tabs.items.length > 1 ? (
        <TabBar
          tabs={tabs.items}
          activeId={tabs.activeId}
          onActivate={tabs.onActivate}
          onClose={tabs.onClose}
          onNew={tabs.onNew}
          testID={`${testID}-tabbar`}
        />
      ) : null}
      <PathBar uri={uri} focused={focused} onNavigate={navigate} testID={`${testID}-pathbar`} />
      {error ? (
        <Text style={styles.error}>Error: {error.message}</Text>
      ) : (
        <FileList
          view={view}
          rows={rows}
          cursor={cursor}
          marked={markedUriSet}
          focused={focused}
          loading={loading}
          sort={sort}
          onCursorMove={(targetUri) => {
            onFocus?.();
            setCursorUri(targetUri);
          }}
          onActivate={activateRow}
          onChangeSort={(s) => {
            onFocus?.();
            setSort(s);
          }}
          onToggleMark={(i) => {
            onFocus?.();
            setCursor(i);
            toggleMarkAt(i);
          }}
          onColumnStride={setColumnStride}
          testID={`${testID}-list`}
        />
      )}
      <View style={styles.footer} testID={`${testID}-footer`}>
        {footer.kind === "cursor" ? (
          <>
            <Text style={[styles.footerText, styles.footerName]} numberOfLines={1}>
              {footer.name}
            </Text>
            <Text style={[styles.footerText, styles.footerSize]} numberOfLines={1}>
              {footer.size}
            </Text>
            <Text style={[styles.footerText, styles.footerDate]} numberOfLines={1}>
              {footer.date}
            </Text>
            <Text style={[styles.footerText, styles.footerAttr]} numberOfLines={1}>
              {footer.attr}
            </Text>
          </>
        ) : footer.kind === "selection" ? (
          <Text style={[styles.footerText, styles.footerName]} numberOfLines={1}>
            {footer.text}
          </Text>
        ) : (
          <View style={styles.footerName} />
        )}
        {loading ? <View style={styles.loadingDot} /> : null}
        {quickQuery.length > 0 ? (
          <Text style={styles.quickQuery} numberOfLines={1}>
            Search: {quickQuery}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function uriOfRow(r: Row): Uri {
  return r.kind === "parent" ? r.uri : r.stat.uri;
}

function compareEntries(a: Stat, b: Stat, sort: SortSpec): number {
  let cmp = 0;
  switch (sort.key) {
    case "name":
      cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      break;
    case "ext":
      cmp = extOf(a.name).localeCompare(extOf(b.name), undefined, { sensitivity: "base" });
      if (cmp === 0) cmp = a.name.localeCompare(b.name);
      break;
    case "size":
      cmp = a.size - b.size;
      break;
    case "date":
      cmp = a.mtime - b.mtime;
      break;
  }
  return sort.direction === "asc" ? cmp : -cmp;
}

function extOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot <= 0 ? "" : name.slice(dot + 1).toLowerCase();
}

type FooterContent =
  | { kind: "empty" }
  | { kind: "selection"; text: string }
  | { kind: "cursor"; name: string; size: string; date: string; attr: string };

function computeFooter(
  entries: Stat[],
  marked: Set<Uri>,
  cursorRow: Row | null,
): FooterContent {
  // No selection → show the cursor row's stats (TC behavior).
  if (marked.size === 0) {
    if (!cursorRow) return { kind: "empty" };
    if (cursorRow.kind === "parent") {
      return {
        kind: "cursor",
        name: "[..]",
        size: "<DIR>",
        date: "",
        attr: "----",
      };
    }
    const s = cursorRow.stat;
    const isDir = s.kind === "dir";
    return {
      kind: "cursor",
      // Dirs render with TC's [brackets] (DirBrackets=1).
      name: isDir ? `[${s.name}]` : s.name,
      size: isDir ? "<DIR>" : formatBytesGrouped(s.size),
      date: formatDate(s.mtime),
      attr: formatAttr({ kind: s.kind, hidden: s.hidden, exec: s.exec }),
    };
  }

  // Selection summary in TC format:
  //   "<selSize> / <totSize> in <selFiles> / <totFiles> file(s), <selDirs> / <totDirs> dir(s)"
  let selFiles = 0;
  let selDirs = 0;
  let totFiles = 0;
  let totDirs = 0;
  let selSize = 0;
  let totSize = 0;
  for (const e of entries) {
    if (e.kind === "dir") totDirs++;
    else {
      totFiles++;
      totSize += e.size;
    }
    if (marked.has(e.uri)) {
      if (e.kind === "dir") selDirs++;
      else {
        selFiles++;
        selSize += e.size;
      }
    }
  }
  return {
    kind: "selection",
    text: `${formatSize(selSize)} / ${formatSize(totSize)} in ${selFiles} / ${totFiles} file(s), ${selDirs} / ${totDirs} dir(s)`,
  };
}

function formatBytesGrouped(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tcTheme.color.panelBg,
    // RN-Web's Pressable defaults to cursor: pointer (role=button). Children
    // inherit. Force arrow cursor so the panel doesn't look "clickable" as a
    // whole.
    cursor: "default",
  } as object,
  focused: {
    // Focus indicator lives in the cursor-row color now; no panel border.
  },
  viewSwitcher: {
    flexDirection: "row",
    backgroundColor: tcTheme.color.chromeBg,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderBottomWidth: 1,
    borderBottomColor: tcTheme.color.chromeBorder,
  },
  modeButton: {
    paddingHorizontal: 8,
    paddingVertical: 1,
    marginRight: 4,
    borderWidth: 1,
    borderColor: tcTheme.color.chromeBorder,
    backgroundColor: tcTheme.color.fbarButtonBg,
  },
  modeButtonActive: {
    backgroundColor: tcTheme.color.panelBorderFocused,
    borderColor: tcTheme.color.panelBorderFocused,
  },
  modeText: {
    color: tcTheme.color.text,
    fontFamily: tcTheme.font.ui,
    fontSize: tcTheme.font.sizeSmall,
  },
  modeTextActive: {
    color: "#FFFFFF",
  },
  error: {
    color: tcTheme.color.textMarked,
    fontFamily: tcTheme.font.ui,
    fontSize: tcTheme.font.size,
    padding: 6,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingVertical: 2,
    backgroundColor: tcTheme.color.chromeBg,
    borderTopWidth: 1,
    borderTopColor: tcTheme.color.chromeBorder,
  },
  footerText: {
    color: tcTheme.color.text,
    fontFamily: tcTheme.font.ui,
    fontSize: tcTheme.font.sizeSmall,
  },
  // Cursor-info layout: name grows, size/date/attr right-aligned with gaps.
  footerName: {
    flex: 1,
    minWidth: 0,
  },
  footerSize: {
    textAlign: "right",
    marginLeft: 20,
    minWidth: 60,
  },
  footerDate: {
    textAlign: "right",
    marginLeft: 20,
    minWidth: 130,
  },
  footerAttr: {
    textAlign: "right",
    marginLeft: 20,
    minWidth: 40,
    fontFamily: tcTheme.font.mono,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: tcTheme.color.panelBorderFocused,
    marginLeft: 8,
    // @ts-expect-error RN-Web-only animation props.
    animationKeyframes: [
      { "0%": { opacity: 0.3 }, "50%": { opacity: 1 }, "100%": { opacity: 0.3 } },
    ],
    animationDuration: "1.2s",
    animationIterationCount: "infinite",
    animationTimingFunction: "ease-in-out",
  },
  quickQuery: {
    color: tcTheme.color.panelBorderFocused,
    fontFamily: tcTheme.font.mono,
    fontSize: tcTheme.font.sizeSmall,
    marginLeft: 8,
    paddingHorizontal: 4,
    backgroundColor: tcTheme.color.cursorBgInactive,
  },
});
