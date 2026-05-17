import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  Cloud,
  CloudUpload,
  LayoutGrid,
  LayoutList,
  Network,
  RefreshCw,
  RefreshCcwDot,
  Rows3,
  Search,
} from "lucide-react";
import { Icon } from "./Icon.js";
import { tcTheme } from "./theme.js";

export interface ToolbarButton {
  id: string;
  /** Pre-rendered icon node, or null for separators. */
  icon: ReactNode;
  /** Tooltip-style hint. Not displayed yet; reserved for hover state. */
  hint?: string;
  /** Render as a vertical divider; icon is ignored when true. */
  separator?: boolean;
  onPress?: () => void;
}

const ICON_SIZE = 16;
const ICON_COLOR = "#333333";

const ic = (C: typeof RefreshCw): ReactNode => (
  <Icon icon={C} size={ICON_SIZE} color={ICON_COLOR} strokeWidth={1.75} />
);

/** Defaults mirror the user's default.bar lineup (TC stock toolbar). */
export const DEFAULT_TOOLBAR: readonly ToolbarButton[] = [
  { id: "refresh", icon: ic(RefreshCw), hint: "Reread source" },
  { id: "sep1", icon: null, separator: true },
  { id: "brief", icon: ic(LayoutList), hint: "Brief" },
  { id: "full", icon: ic(Rows3), hint: "Full" },
  { id: "thumb", icon: ic(LayoutGrid), hint: "Thumbnails" },
  { id: "tree", icon: ic(Network), hint: "Tree" },
  { id: "sep2", icon: null, separator: true },
  { id: "back", icon: ic(ArrowLeft), hint: "Back" },
  { id: "fwd", icon: ic(ArrowRight), hint: "Forward" },
  { id: "sep3", icon: null, separator: true },
  { id: "pack", icon: ic(Archive), hint: "Pack" },
  { id: "unpack", icon: ic(ArchiveRestore), hint: "Unpack" },
  { id: "sep4", icon: null, separator: true },
  { id: "ftp", icon: ic(Cloud), hint: "FTP Connect" },
  { id: "ftpNew", icon: ic(CloudUpload), hint: "FTP New" },
  { id: "sep5", icon: null, separator: true },
  { id: "find", icon: ic(Search), hint: "Search" },
  { id: "compare", icon: ic(ArrowLeftRight), hint: "Compare" },
  { id: "sync", icon: ic(RefreshCcwDot), hint: "Sync dirs" },
];

export interface ButtonBarProps {
  buttons?: readonly ToolbarButton[];
  onPress?: (id: string) => void;
}

const nonFocusable = {
  tabIndex: -1,
  onMouseDown: (e: { preventDefault(): void }) => e.preventDefault(),
} as unknown as object;

export function ButtonBar({ buttons = DEFAULT_TOOLBAR, onPress }: ButtonBarProps): JSX.Element {
  return (
    <View style={styles.bar} testID="bc-toolbar">
      {buttons.map((b) =>
        b.separator ? (
          <View key={b.id} style={styles.separator} />
        ) : (
          <Pressable
            key={b.id}
            onPress={() => {
              b.onPress?.();
              onPress?.(b.id);
            }}
            style={styles.button}
            testID={`bc-toolbar-${b.id}`}
            {...nonFocusable}
          >
            {b.icon}
          </Pressable>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tcTheme.color.chromeBg,
    borderBottomWidth: 1,
    borderBottomColor: tcTheme.color.chromeBorder,
    paddingHorizontal: 2,
    paddingVertical: 2,
    minHeight: 26,
  },
  button: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 1,
    borderWidth: 1,
    borderColor: "transparent",
  },
  separator: {
    width: 1,
    height: 16,
    marginHorizontal: 4,
    backgroundColor: tcTheme.color.chromeBorder,
  },
});
