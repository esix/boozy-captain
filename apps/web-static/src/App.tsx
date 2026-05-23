import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { CommandRegistry, type HotkeyMap } from "@bc/core";
import type { SurfaceHandle, SurfaceManager } from "@bc/surfaces";
import { SurfaceLayer, WebSurfaceManager } from "@bc/surfaces-web";
import {
  AppMenu,
  ButtonBar,
  CommandLine,
  DEFAULT_FKEY_ACTIONS,
  FKeyBar,
  Panel,
  TwoPanelLayout,
  tcTheme,
  useGlobalHotkeys,
  type FKeyAction,
  type PanelSelection,
  type TabSpec,
} from "@bc/ui-rn";
import type { Uri, VfsRegistry } from "@bc/vfs";

export interface AppProps {
  vfs: VfsRegistry;
  surfaces: WebSurfaceManager;
}

type PanelIndex = 0 | 1;

interface PanelTabState {
  tabs: TabSpec[];
  activeId: string;
}

const FKEY_COMMANDS: Record<string, string> = {
  F3: "fkey.view",
  F4: "fkey.edit",
  F5: "fkey.copy",
  F6: "fkey.move",
  F7: "fkey.mkdir",
  F8: "fkey.delete",
  "Alt+F4": "fkey.exit",
};

const INITIAL_LEFT_TABS: PanelTabState = {
  activeId: "L1",
  tabs: [
    { id: "L1", uri: "mock:///" },
    { id: "L2", uri: "mock:///home/user/projects" },
    { id: "L3", uri: "mock:///etc" },
  ],
};
const INITIAL_RIGHT_TABS: PanelTabState = {
  activeId: "R1",
  tabs: [
    { id: "R1", uri: "mock:///home/user" },
    { id: "R2", uri: "mock:///home/user/photos" },
    { id: "R3", uri: "mock:///var/log" },
  ],
};

export function App({ vfs, surfaces }: AppProps): JSX.Element {
  const [leftTabs, setLeftTabs] = useState<PanelTabState>(INITIAL_LEFT_TABS);
  const [rightTabs, setRightTabs] = useState<PanelTabState>(INITIAL_RIGHT_TABS);
  const [activeIndex, setActiveIndex] = useState<PanelIndex>(0);
  const [leftViewId, setLeftViewId] = useState<string>("brief");
  const [rightViewId, setRightViewId] = useState<string>("brief");
  const setActiveViewId = (id: string): void => {
    if (activeIndex === 0) setLeftViewId(id);
    else setRightViewId(id);
  };

  const leftUri = activeTabUri(leftTabs);
  const rightUri = activeTabUri(rightTabs);

  const leftSel = useRef<PanelSelection | null>(null);
  const rightSel = useRef<PanelSelection | null>(null);

  const activeSelection = useCallback(
    (): PanelSelection | null => (activeIndex === 0 ? leftSel.current : rightSel.current),
    [activeIndex],
  );

  const fkeyRegistry = useMemo(
    () => buildFkeyRegistry(surfaces, activeSelection, activeIndex),
    [surfaces, activeSelection, activeIndex],
  );
  const fkeyMap: HotkeyMap = useMemo(() => FKEY_COMMANDS, []);
  useGlobalHotkeys({ map: fkeyMap, registry: fkeyRegistry });

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === "Tab" && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const t = e.target as HTMLElement | null;
        e.preventDefault();
        setActiveIndex((i) => (i === 0 ? 1 : 0));
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) t.blur();
        return;
      }
      // Browser intercepts Ctrl+T / Ctrl+Tab / Ctrl+W before web apps see
      // them (they're reserved for browser tabs / window). Electron has no
      // such reservation — those bindings will work natively when we ship
      // the desktop build (target T3). For now in the web target we use
      // Alt-modified equivalents that pass through:
      //   Alt+T            → new tab
      //   Ctrl+PageDown    → next tab
      //   Ctrl+PageUp      → previous tab
      // We also keep the Ctrl+T / Ctrl+Tab handlers registered so they fire
      // in Electron once that build is in place.
      const isCtrl = e.ctrlKey && !e.altKey && !e.metaKey;
      const isAlt = e.altKey && !e.ctrlKey && !e.metaKey;
      if (e.key === "Tab" && isCtrl) {
        e.preventDefault();
        cycleTab(activeIndex, e.shiftKey ? -1 : 1);
        return;
      }
      if ((e.key === "PageDown" || e.key === "PageUp") && isCtrl) {
        e.preventDefault();
        cycleTab(activeIndex, e.key === "PageDown" ? 1 : -1);
        return;
      }
      if ((e.key === "t" || e.key === "T") && (isCtrl || isAlt)) {
        e.preventDefault();
        newTab(activeIndex);
        return;
      }
      // Alt+W (web) / Ctrl+W (Electron) → close active tab.
      // Browser intercepts Ctrl+W to close the page; Alt+W is the web fallback.
      if ((e.key === "w" || e.key === "W") && (isCtrl || isAlt)) {
        e.preventDefault();
        closeActiveTab(activeIndex);
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeIndex]);

  const fkeyActions: readonly FKeyAction[] = DEFAULT_FKEY_ACTIONS.map((a) => {
    const cmd = FKEY_COMMANDS[a.key];
    return {
      ...a,
      onPress: cmd
        ? () => {
            void fkeyRegistry.run(cmd);
          }
        : undefined,
    };
  });

  const activeUri = activeIndex === 0 ? leftUri : rightUri;
  // Per-panel mutators for tabs and current URI
  const setSideUri = (side: PanelIndex, next: Uri): void => {
    const setter = side === 0 ? setLeftTabs : setRightTabs;
    setter((prev) => ({
      ...prev,
      tabs: prev.tabs.map((t) => (t.id === prev.activeId ? { ...t, uri: next } : t)),
    }));
  };
  const activateTab = (side: PanelIndex, id: string): void => {
    const setter = side === 0 ? setLeftTabs : setRightTabs;
    setter((prev) => ({ ...prev, activeId: id }));
    setActiveIndex(side);
  };
  const closeTab = (side: PanelIndex, id: string): void => {
    const setter = side === 0 ? setLeftTabs : setRightTabs;
    setter((prev) => {
      if (prev.tabs.length <= 1) return prev;
      const idx = prev.tabs.findIndex((t) => t.id === id);
      const next = prev.tabs.filter((t) => t.id !== id);
      const newActive =
        prev.activeId === id ? next[Math.max(0, idx - 1)]!.id : prev.activeId;
      return { tabs: next, activeId: newActive };
    });
  };
  const newTab = (side: PanelIndex): void => {
    const setter = side === 0 ? setLeftTabs : setRightTabs;
    setter((prev) => {
      const id = `${side === 0 ? "L" : "R"}${Date.now()}`;
      const currentUri = prev.tabs.find((t) => t.id === prev.activeId)?.uri ?? "mock:///";
      return { tabs: [...prev.tabs, { id, uri: currentUri }], activeId: id };
    });
    setActiveIndex(side);
  };
  const cycleTab = (side: PanelIndex, delta: 1 | -1): void => {
    const setter = side === 0 ? setLeftTabs : setRightTabs;
    setter((prev) => {
      if (prev.tabs.length <= 1) return prev;
      const idx = prev.tabs.findIndex((t) => t.id === prev.activeId);
      const next = (idx + delta + prev.tabs.length) % prev.tabs.length;
      return { ...prev, activeId: prev.tabs[next]!.id };
    });
  };
  const closeActiveTab = (side: PanelIndex): void => {
    const state = side === 0 ? leftTabs : rightTabs;
    if (state.tabs.length <= 1) return; // never close the last tab
    closeTab(side, state.activeId);
  };

  return (
    <View style={styles.root}>
      <AppMenu>
        <AppMenu.Menu title="Files">
          <AppMenu.Item title="Change Attributes…" onPress={() => console.log("[menu] files.changeAttr")} />
          <AppMenu.Item title="Pack…" onPress={() => console.log("[menu] files.pack")} />
          <AppMenu.Item title="Unpack Specific Files…" onPress={() => console.log("[menu] files.unpack")} />
          <AppMenu.Separator />
          <AppMenu.Item title="Compare By Content…" onPress={() => console.log("[menu] files.compare")} />
          <AppMenu.Item title="Split File…" onPress={() => console.log("[menu] files.split")} />
          <AppMenu.Item title="Combine Files…" onPress={() => console.log("[menu] files.combine")} />
          <AppMenu.Separator />
          <AppMenu.Item title="Exit" onPress={() => console.log("[menu] files.exit")} />
        </AppMenu.Menu>
        <AppMenu.Menu title="Mark">
          <AppMenu.Item title="Select Group…" onPress={() => console.log("[menu] mark.selectGroup")} />
          <AppMenu.Item title="Unselect Group…" onPress={() => console.log("[menu] mark.unselectGroup")} />
          <AppMenu.Item title="Select All" onPress={() => console.log("[menu] mark.selectAll")} />
          <AppMenu.Item title="Unselect All" onPress={() => console.log("[menu] mark.unselectAll")} />
          <AppMenu.Item title="Invert Selection" onPress={() => console.log("[menu] mark.invert")} />
        </AppMenu.Menu>
        <AppMenu.Menu title="Commands">
          <AppMenu.Item title="Open Command-Prompt" onPress={() => console.log("[menu] commands.openConsole")} />
          <AppMenu.Item title="Search…" onPress={() => console.log("[menu] commands.search")} />
          <AppMenu.Item title="Synchronize Dirs…" onPress={() => console.log("[menu] commands.syncDirs")} />
          <AppMenu.Item title="Multi-Rename Tool…" onPress={() => console.log("[menu] commands.multiRename")} />
        </AppMenu.Menu>
        <AppMenu.Menu title="Net">
          <AppMenu.Item title="FTP Connect…" onPress={() => console.log("[menu] net.ftpConnect")} />
          <AppMenu.Item title="FTP New Connection…" onPress={() => console.log("[menu] net.ftpNew")} />
          <AppMenu.Item title="FTP Disconnect" onPress={() => console.log("[menu] net.ftpDisconnect")} />
        </AppMenu.Menu>
        <AppMenu.Menu title="Show">
          <AppMenu.Item title="Brief" onPress={() => setActiveViewId("brief")} />
          <AppMenu.Item title="Full" onPress={() => setActiveViewId("full")} />
          <AppMenu.Item title="Tree" onPress={() => setActiveViewId("tree")} />
          <AppMenu.Item title="Thumbnail View" onPress={() => console.log("[menu] show.thumbnails")} />
          <AppMenu.Separator />
          <AppMenu.Item title="Quick View Panel" onPress={() => console.log("[menu] show.quickView")} />
        </AppMenu.Menu>
        <AppMenu.Menu title="Configuration">
          <AppMenu.Item title="Options…" onPress={() => console.log("[menu] config.options")} />
          <AppMenu.Item title="File Types & Icons…" onPress={() => console.log("[menu] config.fileTypes")} />
          <AppMenu.Item title="Change Button Bar…" onPress={() => console.log("[menu] config.buttonBar")} />
        </AppMenu.Menu>
        <AppMenu.Menu title="Start">
          <AppMenu.Item title="Calculator" onPress={() => console.log("[menu] start.calculator")} />
        </AppMenu.Menu>
        <AppMenu.Menu title="Help" align="end">
          <AppMenu.Item title="Contents" onPress={() => console.log("[menu] help.contents")} />
          <AppMenu.Item title="About…" onPress={() => console.log("[menu] help.about")} />
        </AppMenu.Menu>
      </AppMenu>
      <ButtonBar onPress={(id) => console.log(`[toolbar] ${id}`)} />
      <TwoPanelLayout
        left={
          <Panel
            testID="bc-panel-left"
            vfs={vfs}
            uri={leftUri}
            viewId={leftViewId}
            onNavigate={(u) => setSideUri(0, u)}
            focused={activeIndex === 0}
            onFocus={() => setActiveIndex(0)}
            onSelectionChange={(sel) => {
              leftSel.current = sel;
            }}
            driveInfo="[Local Disk]   mock filesystem"
            onCreateTab={() => newTab(0)}
            tabs={{
              items: leftTabs.tabs,
              activeId: leftTabs.activeId,
              onActivate: (id) => activateTab(0, id),
              onClose: (id) => closeTab(0, id),
              onNew: () => newTab(0),
            }}
          />
        }
        right={
          <Panel
            testID="bc-panel-right"
            vfs={vfs}
            uri={rightUri}
            viewId={rightViewId}
            onNavigate={(u) => setSideUri(1, u)}
            focused={activeIndex === 1}
            onFocus={() => setActiveIndex(1)}
            onSelectionChange={(sel) => {
              rightSel.current = sel;
            }}
            driveInfo="[Local Disk]   mock filesystem"
            onCreateTab={() => newTab(1)}
            tabs={{
              items: rightTabs.tabs,
              activeId: rightTabs.activeId,
              onActivate: (id) => activateTab(1, id),
              onClose: (id) => closeTab(1, id),
              onNew: () => newTab(1),
            }}
          />
        }
      />
      <CommandLine
        prompt={activeUri}
        onSubmit={(cmd) => {
          console.log(`run: ${cmd}`);
        }}
      />
      <FKeyBar actions={fkeyActions} />
      <SurfaceLayer manager={surfaces} />
    </View>
  );
}

function activeTabUri(state: PanelTabState): Uri {
  return state.tabs.find((t) => t.id === state.activeId)?.uri ?? "mock:///";
}

function buildFkeyRegistry(
  surfaces: SurfaceManager,
  activeSelection: () => PanelSelection | null,
  activeIndex: PanelIndex,
): CommandRegistry {
  const r = new CommandRegistry();
  r.register({
    id: "fkey.view",
    title: "View",
    run: () => {
      const sel = activeSelection();
      const item = sel?.cursorItem;
      if (!item) return;
      surfaces.open(
        ({ handle }: { handle: SurfaceHandle }) => (
          <ViewPlaceholder uri={item.uri} kind={item.kind} onClose={handle.close} />
        ),
        { kind: "modal", title: `View — ${item.name}` },
      );
    },
  });
  r.register({
    id: "fkey.edit",
    title: "Edit",
    run: () => console.log(`[F4 Edit] panel=${activeIndex}`),
  });
  r.register({
    id: "fkey.copy",
    title: "Copy",
    run: () => {
      const sel = activeSelection();
      surfaces.open(
        ({ handle }: { handle: SurfaceHandle }) => (
          <PlaceholderBody
            title="Copy (stub)"
            text={`Would copy ${sel?.marked.length ?? 0} marked file(s) and the cursor row.\nA later slice wires this to a real CopyProcess.`}
            onClose={handle.close}
          />
        ),
        { kind: "modal", title: "Copy" },
      );
    },
  });
  r.register({ id: "fkey.move", title: "Move", run: () => console.log(`[F6 Move]`) });
  r.register({ id: "fkey.mkdir", title: "NewFolder", run: () => console.log(`[F7 NewFolder]`) });
  r.register({ id: "fkey.delete", title: "Delete", run: () => console.log(`[F8 Delete]`) });
  r.register({ id: "fkey.exit", title: "Exit", run: () => console.log(`[Alt+F4 Exit]`) });
  return r;
}

function ViewPlaceholder({
  uri,
  kind,
  onClose,
}: {
  uri: Uri;
  kind: string;
  onClose: () => void;
}): JSX.Element {
  return (
    <View>
      <Text style={styles.placeholderHeader}>F3 View — placeholder</Text>
      <Text style={styles.placeholderText}>URI: {uri}</Text>
      <Text style={styles.placeholderText}>Kind: {kind}</Text>
      <Text style={styles.placeholderHint}>
        Press Esc to close. Real lister-text plugin and file content stream land next.
      </Text>
      <Pressy onClose={onClose} />
    </View>
  );
}

function PlaceholderBody({
  title,
  text,
  onClose,
}: {
  title: string;
  text: string;
  onClose: () => void;
}): JSX.Element {
  return (
    <View>
      <Text style={styles.placeholderHeader}>{title}</Text>
      <Text style={styles.placeholderText}>{text}</Text>
      <Pressy onClose={onClose} />
    </View>
  );
}

function Pressy({ onClose }: { onClose: () => void }): JSX.Element {
  return (
    <View style={styles.closeRow}>
      <Text accessibilityRole="button" onPress={onClose} style={styles.closeLink}>
        [ Close ]
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    height: "100%",
    flexDirection: "column",
    backgroundColor: tcTheme.color.chromeBg,
  },
  placeholderHeader: {
    color: tcTheme.color.text,
    fontFamily: tcTheme.font.ui,
    fontSize: tcTheme.font.size,
    fontWeight: "600",
    marginBottom: 8,
  },
  placeholderText: {
    color: tcTheme.color.text,
    fontFamily: tcTheme.font.mono,
    fontSize: tcTheme.font.sizeSmall,
    marginBottom: 4,
  },
  placeholderHint: {
    color: tcTheme.color.textDim,
    fontFamily: tcTheme.font.ui,
    fontSize: tcTheme.font.sizeSmall,
    marginTop: 8,
  },
  closeRow: {
    marginTop: 12,
    alignItems: "flex-end",
  },
  closeLink: {
    color: tcTheme.color.panelBorderFocused,
    fontFamily: tcTheme.font.ui,
    fontSize: tcTheme.font.size,
  },
});
