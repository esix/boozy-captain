import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Uri } from "@bc/vfs";
import { tcTheme } from "./theme.js";

export interface PathBarProps {
  uri: Uri;
  onUp: () => void;
}

export function PathBar({ uri, onUp }: PathBarProps): JSX.Element {
  return (
    <View style={styles.row}>
      <Pressable onPress={onUp} style={styles.up}>
        <Text style={styles.upText}>..</Text>
      </Pressable>
      <Text style={styles.uri} numberOfLines={1}>
        {uri}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tcTheme.color.chromeBg,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderBottomWidth: 1,
    borderBottomColor: tcTheme.color.chromeBorder,
    minHeight: 22,
  },
  up: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginRight: 6,
    backgroundColor: tcTheme.color.fbarButtonBg,
    borderWidth: 1,
    borderColor: tcTheme.color.fbarButtonBorder,
  },
  upText: {
    color: tcTheme.color.text,
    fontFamily: tcTheme.font.ui,
    fontSize: tcTheme.font.sizeSmall,
  },
  uri: {
    color: tcTheme.color.text,
    fontFamily: tcTheme.font.mono,
    fontSize: tcTheme.font.sizeSmall,
    flexShrink: 1,
  },
});
