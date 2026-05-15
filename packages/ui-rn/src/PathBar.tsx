import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Uri } from "@bc/vfs";

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
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#1f2933",
    borderBottomWidth: 1,
    borderBottomColor: "#0b1117",
  },
  up: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 8,
    backgroundColor: "#334155",
    borderRadius: 3,
  },
  upText: {
    color: "#e2e8f0",
    fontFamily: "monospace",
  },
  uri: {
    color: "#e2e8f0",
    fontFamily: "monospace",
    flexShrink: 1,
  },
});
