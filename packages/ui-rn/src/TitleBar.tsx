import { Pressable, StyleSheet, Text, View } from "react-native";
import { tcTheme } from "./theme.js";

export interface TitleBarProps {
  title: string;
  /** Show the min/max/close window buttons on the right. Defaults to true. */
  showWindowButtons?: boolean;
}

/**
 * In-app title bar that mirrors TC's "Total Commander (x64) ..." top row.
 * Browser users get window identity without a native frame; Electron later
 * can hide the OS frame entirely and use this strip as the draggable region.
 */
const nonFocusable = {
  tabIndex: -1,
  onMouseDown: (e: { preventDefault(): void }) => e.preventDefault(),
} as unknown as object;

export function TitleBar({ title, showWindowButtons = true }: TitleBarProps): JSX.Element {
  return (
    <View style={styles.bar} testID="bc-titlebar">
      <View style={styles.iconBox}>
        <Text style={styles.iconText}>BC</Text>
      </View>
      <Text style={styles.title} numberOfLines={1} testID="bc-titlebar-title">
        {title}
      </Text>
      <View style={styles.spacer} />
      {showWindowButtons ? (
        <View style={styles.windowButtons}>
          <Pressable style={styles.winBtn} testID="bc-titlebar-min" {...nonFocusable}>
            <Text style={styles.winBtnText}>_</Text>
          </Pressable>
          <Pressable style={styles.winBtn} testID="bc-titlebar-max" {...nonFocusable}>
            <Text style={styles.winBtnText}>▢</Text>
          </Pressable>
          <Pressable style={[styles.winBtn, styles.closeBtn]} testID="bc-titlebar-close" {...nonFocusable}>
            <Text style={[styles.winBtnText, styles.closeBtnText]}>×</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tcTheme.color.chromeBg,
    borderBottomWidth: 1,
    borderBottomColor: tcTheme.color.chromeBorder,
    paddingLeft: 6,
    minHeight: 28,
  },
  iconBox: {
    width: 18,
    height: 18,
    backgroundColor: tcTheme.color.panelBorderFocused,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  iconText: {
    color: "#FFFFFF",
    fontFamily: tcTheme.font.ui,
    fontSize: 10,
    fontWeight: "700",
  },
  title: {
    color: tcTheme.color.text,
    fontFamily: tcTheme.font.ui,
    fontSize: tcTheme.font.size,
    fontWeight: "500",
  },
  spacer: { flex: 1 },
  windowButtons: {
    flexDirection: "row",
  },
  winBtn: {
    width: 42,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  winBtnText: {
    color: tcTheme.color.text,
    fontFamily: tcTheme.font.ui,
    fontSize: 14,
  },
  closeBtn: {},
  closeBtnText: {
    fontSize: 16,
  },
});
