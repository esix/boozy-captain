import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import type { Uri } from "@bc/vfs";
import { buildUri, parseUri } from "@bc/vfs";
import { tcTheme } from "./theme.js";

export interface PathBarProps {
  uri: Uri;
  /** Current filter (e.g. "*.*"). Reserved — clicking the chip opens a stub. */
  filter?: string;
  /** Active panel? Tints the bar background (TC classic blue). */
  focused?: boolean;
  onNavigate?: (uri: Uri) => void;
  onChangeFilter?: (next: string) => void;
  testID?: string;
}

/**
 * TC-style breadcrumb path bar, kept to a single line. The segments live in a
 * horizontal scroller that auto-scrolls to the end (deepest = current dir
 * always visible). When the path overflows, ‹ › arrows appear to scroll it —
 * matching TC, and avoiding the wrap-to-two-lines we'd get from flex-wrap.
 */
const nonFocusable = {
  tabIndex: -1,
  onMouseDown: (e: { preventDefault(): void }) => e.preventDefault(),
} as unknown as object;

export function PathBar({ uri, filter = "*.*", focused = false, onNavigate, onChangeFilter, testID = "bc-pathbar" }: PathBarProps): JSX.Element {
  const { scheme, path } = parseUri(uri);
  const segments = path.split("/").filter((s) => s.length > 0);

  const scrollRef = useRef<ScrollView | null>(null);
  const offsetRef = useRef(0);
  const [contentWidth, setContentWidth] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const overflowing = contentWidth > viewportWidth + 1;

  const scrollBy = (delta: number): void => {
    const target = Math.max(0, offsetRef.current + delta);
    scrollRef.current?.scrollTo({ x: target, animated: true });
  };

  // On path change, reveal the deepest segment (the current directory). We
  // can't scroll in a uri effect — the new segments aren't laid out yet, so
  // we'd scroll to the *old* end. Instead arm a flag and scroll when the
  // content size actually updates (onContentSizeChange, after re-layout).
  const wantEndRef = useRef(true);
  useEffect(() => {
    wantEndRef.current = true;
  }, [uri]);

  return (
    <View style={[styles.row, focused ? styles.rowActive : styles.rowInactive]} testID={testID}>
      <Pressable style={styles.historyButton} testID={`${testID}-history`} {...nonFocusable}>
        <Text style={styles.historyText}>▼</Text>
      </Pressable>
      {overflowing ? (
        <Pressable onPress={() => scrollBy(-100)} style={styles.arrowButton} testID={`${testID}-scroll-left`} {...nonFocusable}>
          <Text style={styles.arrowText}>⏴</Text>
        </Pressable>
      ) : null}
      <View
        style={styles.scrollHost}
        onLayout={(e: LayoutChangeEvent) => setViewportWidth(e.nativeEvent.layout.width)}
      >
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.path}
          onContentSizeChange={(w) => {
            setContentWidth(w);
            if (wantEndRef.current) {
              wantEndRef.current = false;
              requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: false }));
            }
          }}
          onScroll={(e) => {
            offsetRef.current = e.nativeEvent.contentOffset.x;
          }}
          scrollEventThrottle={16}
          testID={`${testID}-scroll`}
        >
          <Pressable onPress={() => onNavigate?.(buildUri(scheme, "/"))} testID={`${testID}-segment-root`} {...nonFocusable}>
            <Text style={styles.segmentText} numberOfLines={1}>{scheme}:</Text>
          </Pressable>
          <Text style={styles.separator}>\</Text>
          {segments.map((s, i) => {
            const target = buildUri(scheme, "/" + segments.slice(0, i + 1).join("/"));
            return (
              <View key={`${i}-${s}`} style={styles.segmentGroup}>
                <Pressable onPress={() => onNavigate?.(target)} testID={`${testID}-segment-${i}`} {...nonFocusable}>
                  <Text style={styles.segmentText} numberOfLines={1}>{s}</Text>
                </Pressable>
                <Text style={styles.separator}>\</Text>
              </View>
            );
          })}
        </ScrollView>
      </View>
      {overflowing ? (
        <Pressable onPress={() => scrollBy(100)} style={styles.arrowButton} testID={`${testID}-scroll-right`} {...nonFocusable}>
          <Text style={styles.arrowText}>⏵</Text>
        </Pressable>
      ) : null}
      <Pressable onPress={() => onChangeFilter?.(filter)} style={styles.filterChip} testID={`${testID}-filter`} {...nonFocusable}>
        <Text style={styles.filterText}>{filter}</Text>
        <Text style={styles.filterCaret}>▼</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: tcTheme.color.chromeBorder,
    paddingLeft: 2,
    paddingRight: 0,
    paddingVertical: 0,
    height: 18,
  },
  rowActive: {
    backgroundColor: "#99B4D1",
  },
  rowInactive: {
    backgroundColor: "#BFCDDB",
  },
  historyButton: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginRight: 4,
  },
  historyText: {
    color: tcTheme.color.textDim,
    fontFamily: tcTheme.font.ui,
    fontSize: 9,
  },
  scrollHost: {
    flex: 1,
    minWidth: 0,
    alignSelf: "stretch",
  },
  path: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: "100%",
  },
  segmentGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  segmentText: {
    color: tcTheme.color.text,
    fontFamily: tcTheme.font.ui,
    fontSize: tcTheme.font.sizeSmall,
    paddingHorizontal: 2,
  },
  separator: {
    color: tcTheme.color.textDim,
    fontFamily: tcTheme.font.ui,
    fontSize: tcTheme.font.sizeSmall,
  },
  arrowButton: {
    width: 14,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    cursor: "default",
  } as object,
  arrowText: {
    color: tcTheme.color.text,
    fontFamily: tcTheme.font.ui,
    fontSize: 9,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    paddingHorizontal: 4,
    paddingVertical: 0,
    borderLeftWidth: 1,
    borderLeftColor: tcTheme.color.chromeBorder,
    backgroundColor: tcTheme.color.panelBg,
    marginLeft: 4,
  },
  filterText: {
    color: tcTheme.color.text,
    fontFamily: tcTheme.font.mono,
    fontSize: tcTheme.font.sizeSmall,
    minWidth: 28,
    paddingHorizontal: 2,
  },
  filterCaret: {
    color: tcTheme.color.textDim,
    fontFamily: tcTheme.font.ui,
    fontSize: 9,
    marginLeft: 4,
  },
});
