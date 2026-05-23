import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { tcTheme } from "@bc/theme";
import { ColumnHeader, type ColumnDef } from "./ColumnHeader.js";
import { RowIcon } from "./RowIcon.js";
import { ROW_HEIGHT, rowColors, splitName } from "./rowStyle.js";
import type { FileListView, FileListViewProps, Row } from "./types.js";

// Brief renders all four headers (matches TC) even though body only has name+ext.
const COLUMNS: readonly ColumnDef[] = [
  { id: "name", sortKey: "name", label: "Name", flex: 3 },
  { id: "ext", sortKey: "ext", label: "Ext", flex: 1 },
  { id: "size", sortKey: "size", label: "Size", flex: 1, alignRight: true },
  { id: "date", sortKey: "date", label: "Date", flex: 2, alignRight: true },
];

const HEADER_HEIGHT = 18;
const SCROLLBAR_HEIGHT = 8; // matches index.html ::-webkit-scrollbar height
const NAME_EXT_GAP = 8;
const COL_GUTTER = 8;
const MIN_COL_WIDTH = 80;

/**
 * TC's Brief mode: items flow column-major into a multi-column newspaper
 * layout. Column width is determined by the longest item; horizontal
 * ScrollView when columns overflow. Header stays as the 4-column TC header.
 */
// Memoized row — only re-renders when its visible props actually change, so
// a cursor move doesn't re-render every row in a 1000-entry list. Callback
// identity is deliberately ignored (those closures are recreated each parent
// render but their behavior is unchanged).
// Function declaration `BriefRowImpl` (defined below) is hoisted, so it's
// safe to reference here.
const BriefRow = memo(BriefRowImpl, (a, b) => {
  return (
    a.row === b.row &&
    a.flatIndex === b.flatIndex &&
    a.display === b.display &&
    a.isCursor === b.isCursor &&
    a.focused === b.focused &&
    a.isMarked === b.isMarked
  );
});

function BriefBody(props: FileListViewProps): JSX.Element {
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
    onColumnStride,
    testID,
  } = props;
  const [container, setContainer] = useState({ width: 0, height: 0 });
  const scrollRef = useRef<ScrollView | null>(null);
  const scrollOffsetRef = useRef(0);
  const containerRef = useRef<View | null>(null);

  // Vertical mouse-wheel → horizontal scroll (Brief is column-major; users
  // with a mouse expect to flick through columns with the wheel).
  // We attach as a non-passive listener so preventDefault works in Chrome,
  // and only intercept when the wheel is predominantly vertical (touchpads
  // doing horizontal wheel still pass through to natural horizontal scroll).
  useEffect(() => {
    const el = containerRef.current as unknown as HTMLElement | null;
    if (!el) return;
    const handler = (e: WheelEvent): void => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      const sv = scrollRef.current;
      if (!sv) return;
      const next = Math.max(0, scrollOffsetRef.current + e.deltaY);
      sv.scrollTo({ x: next, animated: false });
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  const display = useMemo(() => rows.map(displayFor), [rows]);

  // Measure the widest item via Canvas (web only). Falls back to a
  // character-count estimate so native RN still renders something sensible.
  const widest = useMemo(() => {
    const estimate = (s: string): number => s.length * 7.2; // crude Segoe-ish
    if (typeof document !== "undefined") {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.font = `${tcTheme.font.size}px ${tcTheme.font.ui}`;
        let max = MIN_COL_WIDTH;
        for (const d of display) {
          const w =
            ctx.measureText(d.name).width +
            (d.ext ? ctx.measureText(d.ext).width + NAME_EXT_GAP : 0);
          if (w > max) max = w;
        }
        return Math.ceil(max);
      }
    }
    let max = MIN_COL_WIDTH;
    for (const d of display) {
      const w = estimate(d.name) + (d.ext ? estimate(d.ext) + NAME_EXT_GAP : 0);
      if (w > max) max = w;
    }
    return Math.ceil(max);
  }, [display]);

  // Column width capped to panel width; if a single name is wider, truncate.
  // Add overhead for row padding (2*4) + icon (14) + icon margin (2) + gutter.
  const ROW_OVERHEAD = 8 + 14 + 2 + COL_GUTTER;
  const naturalColWidth = widest + ROW_OVERHEAD;
  const colWidth =
    container.width > 0 && naturalColWidth > container.width ? container.width : naturalColWidth;

  // Two-pass height calculation: figure out if a horizontal scrollbar will
  // appear, and if so reserve its height so the last row isn't clipped.
  const baseBodyHeight = Math.max(0, container.height - HEADER_HEIGHT);
  const naiveRowsPerCol = Math.max(1, Math.floor(baseBodyHeight / ROW_HEIGHT));
  const naiveCols = Math.ceil(rows.length / naiveRowsPerCol);
  const willScroll = container.width > 0 && naiveCols * colWidth > container.width;
  const bodyHeight = Math.max(0, baseBodyHeight - (willScroll ? SCROLLBAR_HEIGHT : 0));
  const rowsPerCol = Math.max(1, Math.floor(bodyHeight / ROW_HEIGHT));

  const columns: Row[][] = useMemo(() => {
    if (rows.length === 0) return [];
    const cols: Row[][] = [];
    for (let c = 0; c < Math.ceil(rows.length / rowsPerCol); c++) {
      cols.push(rows.slice(c * rowsPerCol, (c + 1) * rowsPerCol));
    }
    return cols;
  }, [rows, rowsPerCol]);

  useEffect(() => {
    if (!scrollRef.current || container.width === 0 || rowsPerCol === 0) return;
    const cursorCol = Math.floor(cursor / rowsPerCol);
    const x = Math.max(0, cursorCol * colWidth - colWidth);
    scrollRef.current.scrollTo({ x, animated: false });
  }, [cursor, rowsPerCol, colWidth, container.width]);

  // Report the horizontal stride so the panel's ArrowLeft/Right move cursor
  // by one column in either direction.
  useEffect(() => {
    onColumnStride?.(rowsPerCol);
    return () => onColumnStride?.(0);
  }, [rowsPerCol, onColumnStride]);

  const onLayout = (e: LayoutChangeEvent): void => {
    const { width, height } = e.nativeEvent.layout;
    setContainer({ width, height });
  };

  return (
    <View style={styles.container} onLayout={onLayout} testID={testID} ref={containerRef}>
      <ColumnHeader columns={COLUMNS} sort={sort} onChangeSort={onChangeSort} />
      {rows.length === 0 ? (
        <Text style={styles.status}>{loading ? "Reading…" : "Empty"}</Text>
      ) : null}
      {rows.length > 0 ? (
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator
          style={styles.scrollOuter}
          contentContainerStyle={styles.scrollContent}
          onScroll={(e) => {
            scrollOffsetRef.current = e.nativeEvent.contentOffset.x;
          }}
          scrollEventThrottle={16}
        >
          {columns.map((colRows, ci) => (
            <View key={ci} style={[styles.column, { width: colWidth }]}>
              {colRows.map((row, ri) => {
                const flatIndex = ci * rowsPerCol + ri;
                // Capture URI at render time — survives row reshuffles caused
                // by streaming + sort.
                const rowUri = row.kind === "parent" ? row.uri : row.stat.uri;
                return (
                  <BriefRow
                    key={rowUri}
                    row={row}
                    flatIndex={flatIndex}
                    display={display[flatIndex]!}
                    isCursor={flatIndex === cursor}
                    focused={focused}
                    isMarked={row.kind === "entry" ? marked.has(row.stat.uri) : false}
                    onPress={() => onCursorMove(rowUri)}
                    onDoublePress={() => {
                      onCursorMove(rowUri);
                      onActivate(row);
                    }}
                    onContextMenu={() => onToggleMark?.(flatIndex)}
                  />
                );
              })}
            </View>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

interface DisplayParts {
  name: string;
  ext: string;
}

function displayFor(row: Row): DisplayParts {
  if (row.kind === "parent") return { name: "[..]", ext: "" };
  const s = splitName(row.stat.name, row.stat.kind === "dir");
  return { name: s.displayName, ext: s.ext };
}

interface BriefRowProps {
  row: Row;
  flatIndex: number;
  display: DisplayParts;
  isCursor: boolean;
  focused: boolean;
  isMarked: boolean;
  onPress: () => void;
  onDoublePress: () => void;
  onContextMenu?: () => void;
}

function BriefRowImpl({
  row,
  flatIndex,
  display,
  isCursor,
  focused,
  isMarked,
  onPress,
  onDoublePress,
  onContextMenu,
}: BriefRowProps): JSX.Element {
  const isParent = row.kind === "parent";
  const isDir = isParent || (row.kind === "entry" && row.stat.kind === "dir");
  const hidden = row.kind === "entry" && row.stat.hidden === true;
  const { bg, text, outline } = rowColors({ isCursor, focused, marked: isMarked, hidden });

  const lastTap = useRef(0);
  const downHandledRef = useRef(false);
  const handlePress = (): void => {
    const now = Date.now();
    if (now - lastTap.current < 300) onDoublePress();
    else onPress();
    lastTap.current = now;
  };

  // Fire the click on mousedown instead of waiting for the click event.
  // Reason: while the directory is streaming, new entries can be inserted
  // into the sorted row order between mousedown and mouseup. The browser
  // only emits `click` when mousedown + mouseup land on the SAME element,
  // so a reshuffle would cause the click to be cancelled. Mousedown is
  // immediate, so the press lands before any reshuffle can happen.
  void onContextMenu; // legacy prop; kept on the interface, not used here
  const webExtras = {
    tabIndex: -1,
    onMouseDown: (e: { button: number; preventDefault(): void }) => {
      e.preventDefault();
      if (e.button !== 0) return; // right-button is handled by the panel
      downHandledRef.current = true;
      handlePress();
    },
    dataSet: { rowIndex: flatIndex },
  } as unknown as object;

  // Fallback for environments where mousedown doesn't fire but onPress does
  // (touch on native, or some odd web edge cases). Dedupes against the
  // mousedown path so we don't double-handle a single interaction.
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
        outline !== "none"
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
      <Text
        style={[styles.cell, styles.nameCell, { color: text }, isDir && styles.dirText]}
        numberOfLines={1}
      >
        {display.name}
      </Text>
      {display.ext ? (
        <Text style={[styles.cell, styles.extCell, { color: text }]} numberOfLines={1}>
          {display.ext}
        </Text>
      ) : null}
    </Pressable>
  );
}

export const briefView: FileListView = {
  id: "brief",
  label: "Brief",
  Component: BriefBody,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
    minHeight: 0,
  },
  scrollOuter: {
    flex: 1,
  },
  scrollContent: { flexDirection: "row" },
  column: { flexDirection: "column" },
  row: {
    flexDirection: "row",
    paddingHorizontal: 4,
    alignItems: "center",
    // RN-Web-only props; ignored on native.
    cursor: "default",
    outlineStyle: "none",
  } as object,
  iconCell: { width: 14, alignItems: "center", justifyContent: "center", marginRight: 2 },
  cell: {
    fontFamily: tcTheme.font.ui,
    fontSize: tcTheme.font.size,
  },
  nameCell: {
    flex: 1,
    minWidth: 0,
  },
  extCell: {
    marginLeft: NAME_EXT_GAP,
    textAlign: "right",
    color: tcTheme.color.textDim,
  },
  dirText: { fontWeight: "500" },
  status: {
    color: tcTheme.color.textDim,
    fontFamily: tcTheme.font.ui,
    fontSize: tcTheme.font.size,
    padding: 6,
  },
});
