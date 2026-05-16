import { useEffect, useSyncExternalStore } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { SurfaceEntry } from "@bc/surfaces";
import { tcTheme } from "@bc/ui-rn";
import type { WebSurfaceManager } from "./WebSurfaceManager.js";

export interface SurfaceLayerProps {
  manager: WebSurfaceManager;
}

/**
 * Mounts on top of the app and renders all open surfaces. Modal surfaces
 * cover the underlying app with a dimmer; window/pill surfaces float.
 */
export function SurfaceLayer({ manager }: SurfaceLayerProps): JSX.Element | null {
  const entries = useSyncExternalStore(
    (cb) => manager.subscribe(cb),
    () => manager.entriesSnapshot(),
    () => manager.entriesSnapshot(),
  );

  // Esc closes the top-most modal
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key !== "Escape") return;
      const top = [...entries].reverse().find((e2) => e2.handle.kind === "modal");
      if (top) {
        e.preventDefault();
        top.handle.close();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [entries]);

  if (entries.length === 0) return null;
  return (
    <View pointerEvents="box-none" style={styles.layer}>
      {entries.map((entry) => (
        <SurfaceShell key={entry.handle.id} entry={entry} />
      ))}
    </View>
  );
}

function SurfaceShell({ entry }: { entry: SurfaceEntry }): JSX.Element {
  const { handle, content: Content, options } = entry;
  const title = options.title ?? "";
  if (handle.kind === "modal") {
    return (
      <View style={styles.modalBackdrop}>
        <View style={styles.modalChrome}>
          <View style={styles.titleBar}>
            <Text style={styles.titleText} numberOfLines={1}>
              {title}
            </Text>
            <Pressable onPress={handle.close} style={styles.closeButton}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>
          <View style={styles.body}>
            <Content handle={handle} />
          </View>
        </View>
      </View>
    );
  }
  if (handle.kind === "window") {
    const x = options.position?.x ?? 80;
    const y = options.position?.y ?? 80;
    const w = options.position?.width ?? 480;
    const h = options.position?.height ?? 360;
    return (
      <View style={[styles.window, { left: x, top: y, width: w, height: h }]}>
        <View style={styles.titleBar}>
          <Text style={styles.titleText} numberOfLines={1}>
            {title}
          </Text>
          <Pressable onPress={handle.close} style={styles.closeButton}>
            <Text style={styles.closeText}>×</Text>
          </Pressable>
        </View>
        <View style={styles.body}>
          <Content handle={handle} />
        </View>
      </View>
    );
  }
  if (handle.kind === "sheet") {
    return (
      <View style={styles.sheet}>
        <View style={styles.titleBar}>
          <Text style={styles.titleText} numberOfLines={1}>
            {title}
          </Text>
          <Pressable onPress={handle.close} style={styles.closeButton}>
            <Text style={styles.closeText}>×</Text>
          </Pressable>
        </View>
        <View style={styles.body}>
          <Content handle={handle} />
        </View>
      </View>
    );
  }
  // pill
  return (
    <Pressable onPress={handle.focus} style={styles.pill}>
      <Text style={styles.pillText} numberOfLines={1}>
        {title || "..."}
      </Text>
      <Pressable onPress={handle.close} style={styles.pillClose}>
        <Text style={styles.closeText}>×</Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalChrome: {
    width: "60%",
    maxWidth: 800,
    minHeight: 240,
    maxHeight: "80%",
    backgroundColor: tcTheme.color.panelBg,
    borderWidth: 1,
    borderColor: tcTheme.color.panelBorder,
    flexDirection: "column",
  },
  window: {
    position: "absolute",
    backgroundColor: tcTheme.color.panelBg,
    borderWidth: 1,
    borderColor: tcTheme.color.panelBorder,
    flexDirection: "column",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 240,
    backgroundColor: tcTheme.color.panelBg,
    borderTopWidth: 1,
    borderTopColor: tcTheme.color.panelBorder,
    flexDirection: "column",
  },
  pill: {
    position: "absolute",
    right: 12,
    bottom: 64,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tcTheme.color.chromeBg,
    borderWidth: 1,
    borderColor: tcTheme.color.chromeBorder,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pillText: {
    color: tcTheme.color.text,
    fontFamily: tcTheme.font.ui,
    fontSize: tcTheme.font.sizeSmall,
    marginRight: 8,
    maxWidth: 200,
  },
  pillClose: {
    paddingHorizontal: 4,
  },
  titleBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: tcTheme.color.panelBorderFocused,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  titleText: {
    color: "#FFFFFF",
    fontFamily: tcTheme.font.ui,
    fontSize: tcTheme.font.size,
    fontWeight: "600",
    flexShrink: 1,
  },
  closeButton: {
    paddingHorizontal: 8,
    paddingVertical: 0,
  },
  closeText: {
    color: "#FFFFFF",
    fontFamily: tcTheme.font.ui,
    fontSize: 16,
    fontWeight: "700",
  },
  body: {
    flex: 1,
    padding: 8,
  },
});
