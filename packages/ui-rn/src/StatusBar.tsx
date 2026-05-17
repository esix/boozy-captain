import { StyleSheet, Text, View } from "react-native";
import { tcTheme } from "./theme.js";

export interface StatusBarProps {
  /** Free-form text shown across the whole bar. */
  text: string;
}

/** TC's bottom-of-window status bar (one line above the command line). */
export function StatusBar({ text }: StatusBarProps): JSX.Element {
  return (
    <View style={styles.bar} testID="bc-statusbar">
      <Text style={styles.text} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: tcTheme.color.chromeBg,
    borderTopWidth: 1,
    borderTopColor: tcTheme.color.chromeBorder,
    paddingHorizontal: 4,
    paddingVertical: 2,
    minHeight: 20,
  },
  text: {
    color: tcTheme.color.text,
    fontFamily: tcTheme.font.ui,
    fontSize: tcTheme.font.sizeSmall,
  },
});
