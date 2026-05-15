import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

export interface TwoPanelLayoutProps {
  left: ReactNode;
  right: ReactNode;
}

export function TwoPanelLayout({ left, right }: TwoPanelLayoutProps): JSX.Element {
  return (
    <View style={styles.row}>
      <View style={styles.cell}>{left}</View>
      <View style={styles.divider} />
      <View style={styles.cell}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: "row",
  },
  cell: {
    flex: 1,
  },
  divider: {
    width: 1,
    backgroundColor: "#1f2933",
  },
});
