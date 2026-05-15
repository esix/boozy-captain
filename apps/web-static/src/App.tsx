import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Panel } from "@bc/ui-rn";
import type { Uri, VfsRegistry } from "@bc/vfs";

export interface AppProps {
  vfs: VfsRegistry;
}

export function App({ vfs }: AppProps): JSX.Element {
  const [uri, setUri] = useState<Uri>("mock:///");

  return (
    <View style={styles.root}>
      <View style={styles.titleBar}>
        <Text style={styles.title}>Boozy Captain — walking skeleton</Text>
      </View>
      <View style={styles.panels}>
        <Panel vfs={vfs} uri={uri} onNavigate={setUri} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    height: "100%",
    flexDirection: "column",
  },
  titleBar: {
    backgroundColor: "#0b1117",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2933",
  },
  title: {
    color: "#94a3b8",
    fontFamily: "monospace",
    fontSize: 12,
  },
  panels: {
    flex: 1,
    flexDirection: "row",
  },
});
