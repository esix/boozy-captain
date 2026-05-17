import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Uri } from "@bc/vfs";
import { parentUri, parseUri } from "@bc/vfs";
import { tcTheme } from "./theme.js";

export interface DriveBarProps {
  uri: Uri;
  /** Optional free-space label, e.g. "[Local Disk] 92 568 828 k of 498 242 556 k free". */
  info?: string;
  onNavigate: (uri: Uri) => void;
  testID?: string;
}

/**
 * TC-style per-panel drive bar. Combo (scheme + ▼) on the left, free-space
 * info text in the middle, root and parent buttons on the right.
 */
const nonFocusable = {
  tabIndex: -1,
  onMouseDown: (e: { preventDefault(): void }) => e.preventDefault(),
} as unknown as object;

export function DriveBar({ uri, info, onNavigate, testID = "bc-drivebar" }: DriveBarProps): JSX.Element {
  const { scheme } = parseUri(uri);
  return (
    <View style={styles.row} testID={testID}>
      <Pressable style={styles.combo} testID={`${testID}-combo`} {...nonFocusable}>
        <View style={styles.lockIcon} />
        <Text style={styles.comboText}>{scheme}</Text>
        <Text style={styles.comboCaret}>▼</Text>
      </Pressable>
      <Text style={styles.info} numberOfLines={1}>
        {info ?? `[${scheme}://]`}
      </Text>
      <View style={styles.spacer} />
      <Pressable onPress={() => onNavigate(`${scheme}:///`)} style={styles.button} testID={`${testID}-root`} {...nonFocusable}>
        <Text style={styles.buttonText}>\</Text>
      </Pressable>
      <Pressable onPress={() => onNavigate(parentUri(uri))} style={styles.button} testID={`${testID}-up`} {...nonFocusable}>
        <Text style={styles.buttonText}>..</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tcTheme.color.chromeBg,
    borderBottomWidth: 1,
    borderBottomColor: tcTheme.color.chromeBorder,
    paddingHorizontal: 2,
    paddingVertical: 1,
    minHeight: 22,
  },
  combo: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: tcTheme.color.chromeBorder,
    backgroundColor: tcTheme.color.panelBg,
    marginRight: 6,
  },
  lockIcon: {
    width: 10,
    height: 10,
    borderWidth: 1,
    borderColor: "#7A7A7A",
    backgroundColor: "#D4AF37",
    marginRight: 4,
  },
  comboText: {
    color: tcTheme.color.text,
    fontFamily: tcTheme.font.ui,
    fontSize: tcTheme.font.sizeSmall,
    minWidth: 16,
    paddingHorizontal: 2,
  },
  comboCaret: {
    color: tcTheme.color.textDim,
    fontFamily: tcTheme.font.ui,
    fontSize: 9,
    marginLeft: 4,
  },
  info: {
    color: tcTheme.color.text,
    fontFamily: tcTheme.font.ui,
    fontSize: tcTheme.font.sizeSmall,
    flexShrink: 1,
  },
  spacer: {
    flex: 1,
  },
  button: {
    paddingHorizontal: 8,
    paddingVertical: 1,
    marginLeft: 2,
    borderWidth: 1,
    borderColor: tcTheme.color.chromeBorder,
    backgroundColor: tcTheme.color.fbarButtonBg,
  },
  buttonText: {
    color: tcTheme.color.text,
    fontFamily: tcTheme.font.ui,
    fontSize: tcTheme.font.sizeSmall,
  },
});
