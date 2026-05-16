import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { CommandRegistry, type HotkeyMap } from "@bc/core";
import type { SurfaceHandle, SurfaceManager } from "@bc/surfaces";
import { SurfaceLayer, WebSurfaceManager } from "@bc/surfaces-web";
import {
  CommandLine,
  DEFAULT_FKEY_ACTIONS,
  FKeyBar,
  Panel,
  TwoPanelLayout,
  tcTheme,
  useGlobalHotkeys,
  type FKeyAction,
  type PanelSelection,
} from "@bc/ui-rn";
import type { Uri, VfsRegistry } from "@bc/vfs";

export interface AppProps {
  vfs: VfsRegistry;
  surfaces: WebSurfaceManager;
}

type PanelIndex = 0 | 1;

const FKEY_COMMANDS: Record<string, string> = {
  F3: "fkey.view",
  F4: "fkey.edit",
  F5: "fkey.copy",
  F6: "fkey.move",
  F7: "fkey.mkdir",
  F8: "fkey.delete",
  "Alt+F4": "fkey.exit",
};

export function App({ vfs, surfaces }: AppProps): JSX.Element {
  const [leftUri, setLeftUri] = useState<Uri>("mock:///");
  const [rightUri, setRightUri] = useState<Uri>("mock:///home/user");
  const [activeIndex, setActiveIndex] = useState<PanelIndex>(0);

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
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

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

  return (
    <View style={styles.root}>
      <TwoPanelLayout
        left={
          <Panel
            vfs={vfs}
            uri={leftUri}
            onNavigate={setLeftUri}
            focused={activeIndex === 0}
            onFocus={() => setActiveIndex(0)}
            onSelectionChange={(sel) => {
              leftSel.current = sel;
            }}
          />
        }
        right={
          <Panel
            vfs={vfs}
            uri={rightUri}
            onNavigate={setRightUri}
            focused={activeIndex === 1}
            onFocus={() => setActiveIndex(1)}
            onSelectionChange={(sel) => {
              rightSel.current = sel;
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
    run: () => {
      console.log(`[F4 Edit] panel=${activeIndex} cursor=${activeSelection()?.cursorItem?.uri ?? "-"}`);
    },
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
            text={`Would copy ${sel?.marked.length ?? 0} marked file(s) and the cursor row.\nCancel? Or "Run in background"? Will be wired to a real CopyProcess in a later slice.`}
            onClose={handle.close}
          />
        ),
        { kind: "modal", title: "Copy" },
      );
    },
  });
  r.register({
    id: "fkey.move",
    title: "Move",
    run: () => console.log(`[F6 Move]`),
  });
  r.register({
    id: "fkey.mkdir",
    title: "NewFolder",
    run: () => console.log(`[F7 NewFolder]`),
  });
  r.register({
    id: "fkey.delete",
    title: "Delete",
    run: () => console.log(`[F8 Delete]`),
  });
  r.register({
    id: "fkey.exit",
    title: "Exit",
    run: () => console.log(`[Alt+F4 Exit]`),
  });
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
