import { memo, useEffect, useRef } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { tcTheme } from "@bc/theme";
import { ColumnHeader, type ColumnDef } from "./ColumnHeader.js";
import { RowIcon } from "./RowIcon.js";
import { ROW_HEIGHT, formatAttr, formatDate, formatSize, rowColors, splitName } from "./rowStyle.js";
import type { FileListView, FileListViewProps, Row } from "./types.js";

const COLUMNS: readonly ColumnDef[] = [
  { id: "name", sortKey: "name", label: "Name", flex: 3 },
  { id: "ext", sortKey: "ext", label: "Ext", flex: 1 },
  { id: "size", sortKey: "size", label: "Size", flex: 1, alignRight: true },
  { id: "date", sortKey: "date", label: "Date", flex: 2, alignRight: true },
];

// Memoized row — only re-renders when its visible props change, not on
// every cursor move. Callback identity is deliberately ignored.
// `FullRowImpl` is a hoisted function declaration so it's safe to reference
// before its source position.
const FullRow = memo(FullRowImpl, (a, b) => {
  return (
    a.row === b.row &&
    a.flatIndex === b.flatIndex &&
    a.isCursor === b.isCursor &&
    a.focused === b.focused &&
    a.isMarked === b.isMarked &&
    a.isDropTarget === b.isDropTarget
  );
});

function FullBody(props: FileListViewProps): JSX.Element {
  const {
    rows,
    cursor,
    marked,
    focused,
    loading,
    sort,
    onCursorMove,
    onActivate,
    onChangeSort,
    onToggleMark,
    dropHighlightUri,
    testID,
  } = props;
  const listRef = useRef<FlatList<Row> | null>(null);

  useEffect(() => {
    if (!listRef.current || rows.length === 0) return;
    try {
      listRef.current.scrollToIndex({ index: cursor, viewPosition: 0.5, animated: false });
    } catch {
      /* ignore */
    }
  }, [cursor, rows.length]);

  return (
    <View style={styles.container} testID={testID}>
      <ColumnHeader columns={[...COLUMNS, ATTR_COL]} sort={sort} onChangeSort={onChangeSort} />
      <FlatList<Row>
        ref={listRef}
        data={rows as Row[]}
        keyExtractor={(item) => (item.kind === "parent" ? "_parent" : item.stat.uri)}
        getItemLayout={(_, i) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * i, index: i })}
        onScrollToIndexFailed={() => {
          /* ignore */
        }}
        renderItem={({ item, index }) => {
          const rowUri = item.kind === "parent" ? item.uri : item.stat.uri;
          return (
            <FullRow
              row={item}
              flatIndex={index}
              isCursor={index === cursor}
              focused={focused}
              isMarked={item.kind === "entry" ? marked.has(item.stat.uri) : false}
              isDropTarget={dropHighlightUri != null && rowUri === dropHighlightUri}
              onPress={() => onCursorMove(rowUri)}
              onDoublePress={() => {
                onCursorMove(rowUri);
                onActivate(item);
              }}
              onContextMenu={() => onToggleMark?.(index)}
            />
          );
        }}
        ListEmptyComponent={
          loading ? <Text style={styles.status}>Reading…</Text> : <Text style={styles.status}>Empty</Text>
        }
        ListFooterComponent={null}
      />
    </View>
  );
}

// Attr is display-only — no sortKey, so the header cell is non-interactive.
const ATTR_COL: ColumnDef = { id: "attr", label: "Attr", flex: 1, alignRight: true };

function FullRowImpl({
  row,
  flatIndex,
  isCursor,
  focused,
  isMarked,
  isDropTarget,
  onPress,
  onDoublePress,
  onContextMenu,
}: {
  row: Row;
  flatIndex: number;
  isCursor: boolean;
  focused: boolean;
  isMarked: boolean;
  isDropTarget: boolean;
  onPress: () => void;
  onDoublePress: () => void;
  onContextMenu?: () => void;
}): JSX.Element {
  const isParent = row.kind === "parent";
  const isDir = isParent || (row.kind === "entry" && row.stat.kind === "dir");
  const hidden = row.kind === "entry" && row.stat.hidden === true;
  const exec = row.kind === "entry" && row.stat.exec === true;
  const rowUri = isParent ? row.uri : row.stat.uri;
  const { bg, text, outline } = rowColors({ isCursor, focused, marked: isMarked, hidden });

  let name: string;
  let ext: string;
  let sizeText: string;
  let dateText: string;
  let attrText: string;
  if (isParent) {
    name = "[..]";
    ext = "";
    sizeText = "<DIR>";
    dateText = "";
    attrText = "----";
  } else {
    const s = splitName(row.stat.name, row.stat.kind === "dir");
    name = s.displayName;
    ext = s.ext;
    sizeText = row.stat.kind === "dir" ? "<DIR>" : formatSize(row.stat.size);
    dateText = formatDate(row.stat.mtime);
    attrText = formatAttr({ kind: row.stat.kind, hidden, exec });
  }

  const lastTap = useRef(0);
  const downHandledRef = useRef(false);
  const handlePress = (): void => {
    const now = Date.now();
    if (now - lastTap.current < 300) onDoublePress();
    else onPress();
    lastTap.current = now;
  };

  // Fire on mousedown so streaming-induced row reshuffles between mousedown
  // and mouseup don't cancel the click. See BriefView.tsx for the longer
  // explanation.
  void onContextMenu; // legacy prop; not wired here
  const webExtras = {
    tabIndex: -1,
    onMouseDown: (e: { button: number; preventDefault(): void }) => {
      e.preventDefault();
      if (e.button !== 0) return;
      downHandledRef.current = true;
      handlePress();
    },
    dataSet: { rowIndex: flatIndex, dropUri: rowUri, dropKind: isDir ? "dir" : "file" },
  } as unknown as object;
  const fallbackPress = (): void => {
    if (downHandledRef.current) {
      downHandledRef.current = false;
      return;
    }
    handlePress();
  };

  const rowTestId = isParent ? "bc-row-parent" : `bc-row-${row.kind === "entry" ? row.stat.name : ""}`;
  return (
    <Pressable
      onPress={fallbackPress}
      {...webExtras}
      style={[
        styles.row,
        { backgroundColor: bg, height: ROW_HEIGHT },
        // Drop target border (black) wins over the cursor outline (blue).
        isDropTarget
          ? ({
              outlineWidth: 1,
              outlineStyle: "solid",
              outlineColor: "#000000",
              outlineOffset: -1,
            } as object)
          : outline !== "none"
          ? ({
              outlineWidth: 1,
              outlineStyle: "solid",
              outlineColor: outline,
              outlineOffset: -1,
            } as object)
          : null,
      ]}
      testID={rowTestId}
    >
      <View style={styles.iconCell}>
        <RowIcon row={row} size={12} color={text} />
      </View>
      <Text style={[styles.cell, styles.nameCol, { color: text }, isDir && styles.dirText]} numberOfLines={1}>
        {name}
      </Text>
      <Text style={[styles.cell, styles.extCol, { color: text }]} numberOfLines={1}>
        {ext}
      </Text>
      <Text style={[styles.cell, styles.sizeCol, styles.alignRight, { color: text }]} numberOfLines={1}>
        {sizeText}
      </Text>
      <Text style={[styles.cell, styles.dateCol, styles.alignRight, { color: text }]} numberOfLines={1}>
        {dateText}
      </Text>
      <Text style={[styles.cell, styles.attrCol, styles.alignRight, { color: text }]} numberOfLines={1}>
        {attrText}
      </Text>
    </Pressable>
  );
}

export const fullView: FileListView = {
  id: "full",
  label: "Full",
  Component: FullBody,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  row: {
    flexDirection: "row",
    paddingHorizontal: 4,
    alignItems: "center",
    // RN-Web-only props; ignored on native.
    cursor: "default",
    outlineStyle: "none",
  } as object,
  cell: {
    fontFamily: tcTheme.font.ui,
    fontSize: tcTheme.font.size,
    // lineHeight a hair above ROW_HEIGHT so descenders aren't clipped by
    // overflow:hidden; translateY centers Segoe UI's low-sitting glyphs (see
    // BriefView for the longer explanation).
    lineHeight: ROW_HEIGHT + 1,
    transform: [{ translateY: -1 }],
  },
  alignRight: { textAlign: "right" },
  iconCell: { width: 18, alignItems: "center", justifyContent: "center", marginRight: 2 },
  nameCol: { flex: 3 },
  extCol: { flex: 1 },
  sizeCol: { flex: 1 },
  dateCol: { flex: 2 },
  attrCol: { flex: 1 },
  dirText: { fontWeight: "500" },
  status: {
    color: tcTheme.color.textDim,
    fontFamily: tcTheme.font.ui,
    fontSize: tcTheme.font.size,
    padding: 6,
  },
});
