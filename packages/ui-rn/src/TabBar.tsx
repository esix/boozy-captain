import { useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import type { Uri } from "@bc/vfs";
import { uriName } from "@bc/vfs";
import { tcTheme } from "./theme.js";

export interface TabSpec {
  id: string;
  uri: Uri;
  /** Optional fixed label; defaults to the URI's last segment. */
  label?: string;
}

export interface TabBarProps {
  tabs: readonly TabSpec[];
  activeId: string;
  onActivate: (id: string) => void;
  /** Double-click on a tab closes it; double-click on the empty area opens a new one. */
  onClose?: (id: string) => void;
  onNew?: () => void;
  testID?: string;
}

const nonFocusable = {
  tabIndex: -1,
  onMouseDown: (e: { preventDefault(): void }) => e.preventDefault(),
} as unknown as object;

export function TabBar({
  tabs,
  activeId,
  onActivate,
  onClose,
  onNew,
  testID = "bc-tabbar",
}: TabBarProps): JSX.Element {
  const lastTabTapRef = useRef<Record<string, number>>({});
  const lastEmptyTapRef = useRef(0);
  const scrollRef = useRef<ScrollView | null>(null);
  const offsetRef = useRef(0);
  const [contentWidth, setContentWidth] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);

  const overflowing = contentWidth > viewportWidth + 1;
  const scrollBy = (delta: number): void => {
    const target = Math.max(0, offsetRef.current + delta);
    scrollRef.current?.scrollTo({ x: target, animated: true });
  };

  // Scroll the active tab into view (TC: new tabs activate and the bar
  // scrolls so they're visible; cycling via Ctrl+PageDown/Up also brings
  // the new active tab into view).
  useEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.querySelector(`[data-testid="${testID}-tab-${activeId}"]`);
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    }
  }, [activeId, testID, tabs.length]);

  // Tab click: 1st = activate, 2nd within 300ms = close (only when more than
  // one tab exists, matching TC's "don't close the last tab" behavior).
  const handleTabPress = (id: string): void => {
    const now = Date.now();
    const prev = lastTabTapRef.current[id] ?? 0;
    if (now - prev < 300 && onClose && tabs.length > 1) {
      lastTabTapRef.current[id] = 0;
      onClose(id);
      return;
    }
    lastTabTapRef.current[id] = now;
    onActivate(id);
  };

  // Double-click on the empty area of the tab bar → new tab.
  const handleEmptyAreaPress = (): void => {
    const now = Date.now();
    if (now - lastEmptyTapRef.current < 300 && onNew) {
      lastEmptyTapRef.current = 0;
      onNew();
      return;
    }
    lastEmptyTapRef.current = now;
  };

  return (
    <Pressable
      style={styles.row}
      onPress={handleEmptyAreaPress}
      testID={testID}
      {...nonFocusable}
    >
      <View
        style={styles.scrollHost}
        onLayout={(e: LayoutChangeEvent) => setViewportWidth(e.nativeEvent.layout.width)}
      >
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          onContentSizeChange={(w) => setContentWidth(w)}
          onScroll={(e) => {
            offsetRef.current = e.nativeEvent.contentOffset.x;
          }}
          scrollEventThrottle={16}
          testID={`${testID}-scroll`}
        >
          {tabs.map((t) => {
            const active = t.id === activeId;
            return (
              <Pressable
                key={t.id}
                onPress={() => handleTabPress(t.id)}
                style={[styles.tab, active ? styles.tabActive : styles.tabInactive]}
                testID={`${testID}-tab-${t.id}`}
                {...nonFocusable}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={1}>
                  {t.label ?? labelFromUri(t.uri)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      {overflowing ? (
        <View style={styles.arrows}>
          <Pressable
            onPress={() => scrollBy(-120)}
            style={styles.arrowButton}
            testID={`${testID}-scroll-left`}
            {...nonFocusable}
          >
            <Text style={styles.arrowText}>‹</Text>
          </Pressable>
          <Pressable
            onPress={() => scrollBy(120)}
            style={styles.arrowButton}
            testID={`${testID}-scroll-right`}
            {...nonFocusable}
          >
            <Text style={styles.arrowText}>›</Text>
          </Pressable>
        </View>
      ) : null}
    </Pressable>
  );
}

function labelFromUri(uri: Uri): string {
  const name = uriName(uri);
  if (name === "/" || name === "") {
    const colon = uri.indexOf(":");
    return colon > 0 ? `${uri.slice(0, colon)}:\\` : uri;
  }
  return name;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: tcTheme.color.chromeBg,
    borderBottomWidth: 1,
    borderBottomColor: tcTheme.color.chromeBorder,
    minHeight: 22,
    // Empty-area cursor is arrow; tab cursor below overrides for tab cells.
    cursor: "default",
  } as object,
  scrollHost: {
    flex: 1,
    minWidth: 0,
  },
  scroll: {
    alignItems: "center",
    paddingHorizontal: 2,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 2,
    marginRight: 1,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    cursor: "default",
  } as object,
  tabActive: {
    backgroundColor: tcTheme.color.panelBg,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: tcTheme.color.chromeBorder,
  },
  tabInactive: {
    backgroundColor: tcTheme.color.chromeBg,
  },
  tabText: {
    color: tcTheme.color.textDim,
    fontFamily: tcTheme.font.ui,
    fontSize: tcTheme.font.sizeSmall,
    maxWidth: 180,
  },
  tabTextActive: {
    color: tcTheme.color.text,
  },
  arrows: {
    flexDirection: "row",
    alignItems: "stretch",
    borderLeftWidth: 1,
    borderLeftColor: tcTheme.color.chromeBorder,
  },
  arrowButton: {
    width: 18,
    alignItems: "center",
    justifyContent: "center",
    cursor: "default",
  } as object,
  arrowText: {
    color: tcTheme.color.text,
    fontFamily: tcTheme.font.ui,
    fontSize: 14,
    fontWeight: "600",
  },
});
