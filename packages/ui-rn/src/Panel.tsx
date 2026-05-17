import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CommandRegistry } from "@bc/core";
import {
  FileList,
  createDefaultRegistry,
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
  /** Initial view mode id; default "brief" (TC's user setting). */
  initialViewId?: string;
  /** Optional tab strip above the panel. Hidden when undefined. */
  tabs?: PanelTabsProps;
  /** Optional free-space line shown in the DriveBar. */
  driveInfo?: string;
  /** Prefix for data-testid attributes on this panel and its children. */
  testID?: string;
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
  initialViewId = "brief",
  tabs,
  driveInfo,
  testID = "bc-panel",
}: PanelProps): JSX.Element {
  const registry = useMemo(() => viewRegistry ?? createDefaultRegistry(), [viewRegistry]);
  const [viewId, setViewId] = useState<string>(initialViewId);
  const view: FileListView = registry.get(viewId) ?? registry.list()[0]!;

  const { entries, loading, error, reload } = useDirectoryStream(vfs, uri);
  // Cursor identity is a URI (so it follows the file when streaming sort
  // reorders rows). Derived `cursor` index is recomputed each render.
  const [cursorUri, setCursorUri] = useState<Uri | null>(null);
  const [marked, setMarked] = useState<Set<Uri>>(new Set());
  const [sort, setSort] = useState<SortSpec>({ key: "name", direction: "asc" });
  // Horizontal stride reported by the active view. 0 = no horizontal nav
  // (single-column view); >0 = move cursor by that many indices on Left/Right.
  const [columnStride, setColumnStride] = useState(0);

  // Reset selection when uri changes; cursor lands on [..] (parent row).
  useEffect(() => {
    setCursorUri(parentUri(uri));
    setMarked(new Set());
  }, [uri]);

  // Build rows: synthetic [..] always first, then directories (always
  // alphabetical regardless of sort mode), then files sorted per `sort`.
  const rows = useMemo<Row[]>(() => {
    const parent: Row = { kind: "parent", uri: parentUri(uri) };
    const dirs: Stat[] = [];
    const files: Stat[] = [];
    for (const e of entries) (e.kind === "dir" ? dirs : files).push(e);
    dirs.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    files.sort((a, b) => compareEntries(a, b, sort));
    const toRow = (stat: Stat): Row => ({ kind: "entry", stat });
    return [parent, ...dirs.map(toRow), ...files.map(toRow)];
  }, [uri, entries, sort]);

  // Derive cursor index from cursorUri + current rows. If the cursorUri
  // doesn't appear (e.g. file removed), fall back to row 0 ([..]).
  const cursor = useMemo(() => {
    if (cursorUri === null) return 0;
    const idx = rows.findIndex((r) => uriOfRow(r) === cursorUri);
    return idx >= 0 ? idx : 0;
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

  const summary = useMemo(() => computeSummary(entries, marked), [entries, marked]);

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

  const moveCursor = useCallback(
    (delta: number): void => {
      if (rows.length === 0) return;
      setCursor(clamp(cursor + delta, 0, rows.length - 1));
    },
    [rows.length, cursor, setCursor],
  );

  const moveCursorTo = useCallback(
    (pos: "start" | "end"): void => {
      if (rows.length === 0) return;
      setCursor(pos === "start" ? 0 : rows.length - 1);
    },
    [rows.length, setCursor],
  );

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

  // RN-Web's Pressable defaults to tabIndex=0 (role=button) — making it a
  // focus target so Space/Enter pressed afterwards activate the Pressable
  // instead of reaching the panel's keyboard handler. Take it out of the
  // focus order entirely.
  const nonFocusable = {
    tabIndex: -1,
    onMouseDown: (e: { preventDefault(): void }) => e.preventDefault(),
  } as unknown as object;

  return (
    <Pressable
      onPress={onFocus}
      {...nonFocusable}
      style={[styles.container, focused && styles.focused]}
      testID={testID}
    >
      <DriveBar uri={uri} info={driveInfo} onNavigate={navigate} testID={`${testID}-drivebar`} />
      {tabs ? (
        <TabBar
          tabs={tabs.items}
          activeId={tabs.activeId}
          onActivate={tabs.onActivate}
          onClose={tabs.onClose}
          onNew={tabs.onNew}
          testID={`${testID}-tabbar`}
        />
      ) : null}
      <PathBar uri={uri} onNavigate={navigate} testID={`${testID}-pathbar`} />
      <View style={styles.viewSwitcher} testID={`${testID}-viewswitcher`}>
        {registry.list().map((v) => (
          <Pressable
            key={v.id}
            onPress={() => {
              onFocus?.();
              setViewId(v.id);
            }}
            style={[styles.modeButton, v.id === view.id && styles.modeButtonActive]}
            testID={`${testID}-viewmode-${v.id}`}
          >
            <Text style={[styles.modeText, v.id === view.id && styles.modeTextActive]}>
              {v.label}
            </Text>
          </Pressable>
        ))}
      </View>
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
          onCursorMove={setCursor}
          onActivate={activateRow}
          onChangeSort={setSort}
          onToggleMark={(i) => {
            onFocus?.();
            setCursor(i);
            toggleMarkAt(i);
          }}
          onColumnStride={setColumnStride}
        />
      )}
      <View style={styles.footer}>
        <Text style={styles.footerText} numberOfLines={1}>
          {summary}
        </Text>
        {loading ? (
          <View style={styles.loadingDot} />
        ) : null}
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

function computeSummary(entries: Stat[], marked: Set<Uri>): string {
  const total = entries.length;
  const totalSize = entries.reduce((s, e) => s + (e.kind === "file" ? e.size : 0), 0);
  let markedCount = 0;
  let markedSize = 0;
  for (const e of entries) {
    if (marked.has(e.uri)) {
      markedCount++;
      if (e.kind === "file") markedSize += e.size;
    }
  }
  return `${markedCount} / ${total} file(s), ${formatSize(markedSize)} / ${formatSize(totalSize)} marked`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tcTheme.color.panelBg,
  },
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
    flexShrink: 1,
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
