import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Uri } from "@bc/vfs";
import { uriName } from "@bc/vfs";
import { tcTheme } from "./theme.js";

export interface TabSpec {
  id: string;
  uri: Uri;
  /** Optional fixed label; defaults to the URI's last segment. */
  label?: string;
}

export interface TabBarProps {
  tabs: readonly TabSpec[];
  activeId: string;
  onActivate: (id: string) => void;
  onClose?: (id: string) => void;
  onNew?: () => void;
  testID?: string;
}

const nonFocusable = {
  tabIndex: -1,
  onMouseDown: (e: { preventDefault(): void }) => e.preventDefault(),
} as unknown as object;

export function TabBar({ tabs, activeId, onActivate, onClose, onNew, testID = "bc-tabbar" }: TabBarProps): JSX.Element {
  return (
    <View style={styles.row} testID={testID}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {tabs.map((t) => {
          const active = t.id === activeId;
          return (
            <Pressable
              key={t.id}
              onPress={() => onActivate(t.id)}
              style={[styles.tab, active ? styles.tabActive : styles.tabInactive]}
              testID={`${testID}-tab-${t.id}`}
              {...nonFocusable}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={1}>
                {t.label ?? labelFromUri(t.uri)}
              </Text>
              {onClose && tabs.length > 1 && active ? (
                <Pressable
                  onPress={() => onClose(t.id)}
                  style={styles.closeButton}
                  hitSlop={4}
                  testID={`${testID}-tab-${t.id}-close`}
                  {...nonFocusable}
                >
                  <Text style={[styles.closeText, active && styles.tabTextActive]}>×</Text>
                </Pressable>
              ) : null}
            </Pressable>
          );
        })}
        {onNew ? (
          <Pressable onPress={onNew} style={styles.newTab} testID={`${testID}-new`} {...nonFocusable}>
            <Text style={styles.newTabText}>+</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

function labelFromUri(uri: Uri): string {
  const name = uriName(uri);
  if (name === "/" || name === "") {
    // Render scheme root as "scheme:\" — matches TC's drive-letter look.
    const colon = uri.indexOf(":");
    return colon > 0 ? `${uri.slice(0, colon)}:\\` : uri;
  }
  return name;
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: tcTheme.color.chromeBg,
    borderBottomWidth: 1,
    borderBottomColor: tcTheme.color.chromeBorder,
    minHeight: 22,
  },
  scroll: {
    alignItems: "center",
    paddingHorizontal: 2,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 2,
    marginRight: 1,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  tabActive: {
    backgroundColor: tcTheme.color.panelBg,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: tcTheme.color.chromeBorder,
  },
  tabInactive: {
    backgroundColor: tcTheme.color.chromeBg,
  },
  tabText: {
    color: tcTheme.color.textDim,
    fontFamily: tcTheme.font.ui,
    fontSize: tcTheme.font.sizeSmall,
    maxWidth: 180,
  },
  tabTextActive: {
    color: tcTheme.color.text,
  },
  closeButton: {
    marginLeft: 6,
    paddingHorizontal: 2,
  },
  closeText: {
    color: tcTheme.color.textDim,
    fontFamily: tcTheme.font.ui,
    fontSize: 12,
  },
  newTab: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  newTabText: {
    color: tcTheme.color.textDim,
    fontFamily: tcTheme.font.ui,
    fontSize: tcTheme.font.size,
  },
});
