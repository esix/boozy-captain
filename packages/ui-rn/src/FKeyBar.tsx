import { Pressable, StyleSheet, Text, View } from "react-native";
import { tcTheme } from "./theme.js";

export interface FKeyAction {
  key: string;
  label: string;
  onPress?: () => void;
  disabled?: boolean;
}

export interface FKeyBarProps {
  actions?: readonly FKeyAction[];
}

/** TC's classic F-key bar. Defaults match the user's wincmd.ini (KeyButtons=1). */
export const DEFAULT_FKEY_ACTIONS: readonly FKeyAction[] = [
  { key: "F3", label: "View" },
  { key: "F4", label: "Edit" },
  { key: "F5", label: "Copy" },
  { key: "F6", label: "RenMov" },
  { key: "F7", label: "NewFolder" },
  { key: "F8", label: "Delete" },
  { key: "Alt+F4", label: "Exit" },
];

export function FKeyBar({ actions = DEFAULT_FKEY_ACTIONS }: FKeyBarProps): JSX.Element {
  return (
    <View style={styles.bar}>
      {actions.map((a) => (
        <Pressable
          key={a.key}
          onPress={a.onPress}
          disabled={a.disabled}
          style={[styles.button, a.disabled ? styles.buttonDisabled : null]}
        >
          <Text style={styles.keyText}>{a.key}</Text>
          <Text style={styles.labelText}> {a.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: tcTheme.color.fbarBg,
    borderTopWidth: 1,
    borderTopColor: tcTheme.color.chromeBorder,
  },
  button: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    paddingHorizontal: 6,
    backgroundColor: tcTheme.color.fbarButtonBg,
    borderRightWidth: 1,
    borderRightColor: tcTheme.color.fbarButtonBorder,
  },
  buttonHover: {
    backgroundColor: tcTheme.color.fbarButtonBgHover,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  keyText: {
    color: tcTheme.color.fbarKeyText,
    fontFamily: tcTheme.font.ui,
    fontSize: tcTheme.font.size,
    fontWeight: "600",
  },
  labelText: {
    color: tcTheme.color.fbarLabelText,
    fontFamily: tcTheme.font.ui,
    fontSize: tcTheme.font.size,
  },
});
