import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Panel, TwoPanelLayout } from "@bc/ui-rn";
import type { Uri, VfsRegistry } from "@bc/vfs";

export interface AppProps {
  vfs: VfsRegistry;
}

type PanelIndex = 0 | 1;

export function App({ vfs }: AppProps): JSX.Element {
  const [leftUri, setLeftUri] = useState<Uri>("mock:///");
  const [rightUri, setRightUri] = useState<Uri>("mock:///home/user");
  const [activeIndex, setActiveIndex] = useState<PanelIndex>(0);

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === "Tab" && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        setActiveIndex((i) => (i === 0 ? 1 : 0));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <View style={styles.root}>
      <View style={styles.titleBar}>
        <Text style={styles.title}>
          Boozy Captain — walking skeleton · Tab to switch active panel
        </Text>
      </View>
      <TwoPanelLayout
        left={
          <Panel
            vfs={vfs}
            uri={leftUri}
            onNavigate={setLeftUri}
            focused={activeIndex === 0}
            onFocus={() => setActiveIndex(0)}
          />
        }
        right={
          <Panel
            vfs={vfs}
            uri={rightUri}
            onNavigate={setRightUri}
            focused={activeIndex === 1}
            onFocus={() => setActiveIndex(1)}
          />
        }
      />
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
});
