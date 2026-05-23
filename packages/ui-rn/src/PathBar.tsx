import { Pressable, StyleSheet, Text, View } from "react-native";
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
 * TC-style breadcrumb path bar.
 * `▼  scheme://  seg / seg / seg \   <filter ▼>`
 * Each segment is a Pressable that navigates to that prefix.
 */
const nonFocusable = {
  tabIndex: -1,
  onMouseDown: (e: { preventDefault(): void }) => e.preventDefault(),
} as unknown as object;

export function PathBar({ uri, filter = "*.*", focused = false, onNavigate, onChangeFilter, testID = "bc-pathbar" }: PathBarProps): JSX.Element {
  const { scheme, path } = parseUri(uri);
  const segments = path.split("/").filter((s) => s.length > 0);

  return (
    <View style={[styles.row, focused ? styles.rowActive : styles.rowInactive]} testID={testID}>
      <Pressable style={styles.historyButton} testID={`${testID}-history`} {...nonFocusable}>
        <Text style={styles.historyText}>▼</Text>
      </Pressable>
      <View style={styles.path}>
        <Pressable onPress={() => onNavigate?.(buildUri(scheme, "/"))} testID={`${testID}-segment-root`} {...nonFocusable}>
          <Text style={styles.segmentText}>{scheme}:</Text>
        </Pressable>
        <Text style={styles.separator}>\</Text>
        {segments.map((s, i) => {
          const target = buildUri(scheme, "/" + segments.slice(0, i + 1).join("/"));
          return (
            <View key={`${i}-${s}`} style={styles.segmentGroup}>
              <Pressable onPress={() => onNavigate?.(target)} testID={`${testID}-segment-${i}`} {...nonFocusable}>
                <Text style={styles.segmentText}>{s}</Text>
              </Pressable>
              <Text style={styles.separator}>\</Text>
            </View>
          );
        })}
      </View>
      <View style={styles.spacer} />
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
  path: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
    flexWrap: "wrap",
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
  spacer: { flex: 1 },
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
