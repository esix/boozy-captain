import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { CommandRegistry } from "@bc/core";
import type { Stat, Uri, VfsRegistry } from "@bc/vfs";
import { parentUri } from "@bc/vfs";
import { PathBar } from "./PathBar.js";
import { tcTheme } from "./theme.js";
import { useDirectoryStream } from "./useDirectoryStream.js";
import { useGlobalHotkeys } from "./useGlobalHotkeys.js";

export interface PanelSelection {
  entries: readonly Stat[];
  cursor: number;
  cursorItem: Stat | null;
  marked: readonly Stat[];
}

export interface PanelProps {
  vfs: VfsRegistry;
  uri: Uri;
  onNavigate: (uri: Uri) => void;
  focused?: boolean;
  onFocus?: () => void;
  onSelectionChange?: (sel: PanelSelection) => void;
}

const PAGE_SIZE = 10;

export function Panel({
  vfs,
  uri,
  onNavigate,
  focused = false,
  onFocus,
  onSelectionChange,
}: PanelProps): JSX.Element {
  const { entries, loading, error, reload } = useDirectoryStream(vfs, uri);
  const [cursor, setCursor] = useState(0);
  const [marked, setMarked] = useState<Set<Uri>>(new Set());
  const flatListRef = useRef<FlatList<Stat> | null>(null);

  // Reset selection when uri changes
  useEffect(() => {
    setCursor(0);
    setMarked(new Set());
  }, [uri]);

  // Keep cursor in range as entries stream in
  useEffect(() => {
    if (cursor >= entries.length && entries.length > 0) setCursor(entries.length - 1);
  }, [entries.length, cursor]);

  const cursorItem: Stat | null = entries[cursor] ?? null;

  // Push selection up so the App can dispatch F-key commands against it
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

  const activate = useCallback((): void => {
    const item = cursorItem;
    if (item && item.kind === "dir") navigate(item.uri);
  }, [cursorItem, navigate]);

  const moveCursor = useCallback(
    (delta: number): void => {
      if (entries.length === 0) return;
      setCursor((c) => clamp(c + delta, 0, entries.length - 1));
    },
    [entries.length],
  );

  const moveCursorTo = useCallback(
    (pos: "start" | "end"): void => {
      if (entries.length === 0) return;
      setCursor(pos === "start" ? 0 : entries.length - 1);
    },
    [entries.length],
  );

  const toggleMarkAt = useCallback(
    (idx: number): void => {
      const item = entries[idx];
      if (!item) return;
      setMarked((prev) => {
        const next = new Set(prev);
        if (next.has(item.uri)) next.delete(item.uri);
        else next.add(item.uri);
        return next;
      });
    },
    [entries],
  );

  // Panel-local hotkeys, only when focused
  const panelRegistry = useMemo(() => {
    const r = new CommandRegistry();
    r.register({ id: "panel.cursorUp", title: "Up", run: () => moveCursor(-1) });
    r.register({ id: "panel.cursorDown", title: "Down", run: () => moveCursor(1) });
    r.register({ id: "panel.cursorPageUp", title: "PgUp", run: () => moveCursor(-PAGE_SIZE) });
    r.register({ id: "panel.cursorPageDown", title: "PgDn", run: () => moveCursor(PAGE_SIZE) });
    r.register({ id: "panel.cursorHome", title: "Home", run: () => moveCursorTo("start") });
    r.register({ id: "panel.cursorEnd", title: "End", run: () => moveCursorTo("end") });
    r.register({ id: "panel.activate", title: "Enter", run: () => activate() });
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
    return r;
  }, [moveCursor, moveCursorTo, activate, navigate, uri, toggleMarkAt, cursor]);

  const hotkeyMap = useMemo(
    () => ({
      ArrowUp: "panel.cursorUp",
      ArrowDown: "panel.cursorDown",
      PageUp: "panel.cursorPageUp",
      PageDown: "panel.cursorPageDown",
      Home: "panel.cursorHome",
      End: "panel.cursorEnd",
      Enter: "panel.activate",
      Backspace: "panel.up",
      " ": "panel.toggleMark",
      Insert: "panel.toggleMarkAndAdvance",
    }),
    [],
  );

  useGlobalHotkeys({ map: hotkeyMap, registry: panelRegistry, enabled: focused });

  // Keep cursor row visible
  useEffect(() => {
    if (!flatListRef.current) return;
    if (entries.length === 0) return;
    try {
      flatListRef.current.scrollToIndex({ index: cursor, viewPosition: 0.5, animated: false });
    } catch {
      // scrollToIndex may throw on rapid mounts; ignore.
    }
  }, [cursor, entries.length]);

  return (
    <Pressable onPress={onFocus} style={[styles.container, focused && styles.focused]}>
      <PathBar uri={uri} onUp={() => navigate(parentUri(uri))} />
      <View style={styles.header}>
        <Text style={[styles.cell, styles.headerText, styles.nameCol]}>Name</Text>
        <Text style={[styles.cell, styles.headerText, styles.extCol]}>Ext</Text>
        <Text style={[styles.cell, styles.headerText, styles.sizeCol]}>Size</Text>
        <Text style={[styles.cell, styles.headerText, styles.dateCol]}>Date</Text>
      </View>
      {error ? (
        <Text style={styles.error}>Error: {error.message}</Text>
      ) : (
        <FlatList<Stat>
          ref={flatListRef}
          data={entries}
          keyExtractor={(item) => item.uri}
          getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
          onScrollToIndexFailed={() => {
            /* ignored */
          }}
          renderItem={({ item, index }) => (
            <Row
              item={item}
              index={index}
              cursor={cursor}
              marked={marked.has(item.uri)}
              focused={focused}
              onPress={() => {
                onFocus?.();
                setCursor(index);
              }}
              onDoublePress={() => {
                onFocus?.();
                setCursor(index);
                if (item.kind === "dir") navigate(item.uri);
              }}
            />
          )}
          ListEmptyComponent={
            loading ? <Text style={styles.status}>Reading…</Text> : <Text style={styles.status}>Empty</Text>
          }
          ListFooterComponent={
            loading && entries.length > 0 ? <Text style={styles.status}>Reading more…</Text> : null
          }
        />
      )}
      <View style={styles.footer}>
        <Text style={styles.footerText} numberOfLines={1}>
          {summary}
        </Text>
        <Pressable
          onPress={() => {
            onFocus?.();
            reload();
          }}
          style={styles.refresh}
        >
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const ROW_HEIGHT = 18;

interface RowProps {
  item: Stat;
  index: number;
  cursor: number;
  marked: boolean;
  focused: boolean;
  onPress: () => void;
  onDoublePress: () => void;
}

function Row({ item, index, cursor, marked, focused, onPress, onDoublePress }: RowProps): JSX.Element {
  const isDir = item.kind === "dir";
  const isCursor = index === cursor;
  const { displayName, ext } = splitName(item.name, isDir);

  const rowBg =
    isCursor && focused
      ? tcTheme.color.cursorBg
      : isCursor
        ? tcTheme.color.cursorBgInactive
        : "transparent";
  const baseTextColor =
    isCursor && focused
      ? tcTheme.color.cursorText
      : isCursor
        ? tcTheme.color.cursorTextInactive
        : tcTheme.color.text;
  const textColor = marked && !isCursor ? tcTheme.color.textMarked : baseTextColor;

  const lastTap = useRef(0);
  const handlePress = (): void => {
    const now = Date.now();
    if (now - lastTap.current < 300) onDoublePress();
    else onPress();
    lastTap.current = now;
  };

  return (
    <Pressable onPress={handlePress} style={[styles.row, { backgroundColor: rowBg, height: ROW_HEIGHT }]}>
      <Text style={[styles.cell, styles.nameCol, { color: textColor }]} numberOfLines={1}>
        {displayName}
      </Text>
      <Text style={[styles.cell, styles.extCol, { color: textColor }]} numberOfLines={1}>
        {ext}
      </Text>
      <Text style={[styles.cell, styles.sizeCol, { color: textColor }]}>
        {isDir ? "<DIR>" : formatSize(item.size)}
      </Text>
      <Text style={[styles.cell, styles.dateCol, { color: textColor }]}>{formatDate(item.mtime)}</Text>
    </Pressable>
  );
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function splitName(raw: string, isDir: boolean): { displayName: string; ext: string } {
  if (isDir) return { displayName: `[${raw}]`, ext: "" };
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return { displayName: raw, ext: "" };
  return { displayName: raw.slice(0, dot), ext: raw.slice(dot + 1) };
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

function formatSize(n: number): string {
  if (n < 1024) return `${n} b`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} k`;
  return `${(n / 1024 / 1024).toFixed(1)} M`;
}

function formatDate(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number): string => n.toString().padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tcTheme.color.panelBg,
    borderWidth: 1,
    borderColor: tcTheme.color.panelBorder,
  },
  focused: {
    borderColor: tcTheme.color.panelBorderFocused,
  },
  header: {
    flexDirection: "row",
    backgroundColor: tcTheme.color.headerBg,
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: tcTheme.color.headerBorder,
  },
  headerText: {
    color: tcTheme.color.headerText,
    fontWeight: "600",
  },
  row: {
    flexDirection: "row",
    paddingHorizontal: 4,
    alignItems: "center",
  },
  cell: {
    fontFamily: tcTheme.font.ui,
    fontSize: tcTheme.font.size,
  },
  nameCol: { flex: 3 },
  extCol: { flex: 1 },
  sizeCol: { flex: 1, textAlign: "right", paddingRight: 8 },
  dateCol: { flex: 2, textAlign: "right" },
  status: {
    color: tcTheme.color.textDim,
    fontFamily: tcTheme.font.ui,
    fontSize: tcTheme.font.size,
    padding: 6,
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
  refresh: {
    backgroundColor: tcTheme.color.fbarButtonBg,
    borderWidth: 1,
    borderColor: tcTheme.color.fbarButtonBorder,
    paddingVertical: 1,
    paddingHorizontal: 8,
    marginLeft: 6,
  },
  refreshText: {
    color: tcTheme.color.text,
    fontFamily: tcTheme.font.ui,
    fontSize: tcTheme.font.sizeSmall,
  },
});
