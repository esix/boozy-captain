import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { tcTheme } from "./theme.js";

export interface MenuItem {
  id: string;
  label: string;
  /** Optional disabled state. */
  disabled?: boolean;
  /** Optional separator line above this item. */
  separator?: boolean;
}

export interface MenuSpec {
  id: string;
  label: string;
  /** "right" floats the menu (e.g. Help) to the trailing edge. */
  align?: "left" | "right";
  items: readonly MenuItem[];
}

export interface MenuBarProps {
  menus: readonly MenuSpec[];
  onSelect?: (menuId: string, itemId: string) => void;
}

/** Default TC menu structure, label-only (commands not wired). */
export const DEFAULT_MENUS: readonly MenuSpec[] = [
  {
    id: "files",
    label: "Files",
    items: [
      { id: "changeAttr", label: "Change Attributes…" },
      { id: "pack", label: "Pack…" },
      { id: "unpack", label: "Unpack Specific Files…" },
      { id: "compare", label: "Compare By Content…", separator: true },
      { id: "split", label: "Split File…" },
      { id: "combine", label: "Combine Files…" },
      { id: "exit", label: "Exit", separator: true },
    ],
  },
  {
    id: "mark",
    label: "Mark",
    items: [
      { id: "selectGroup", label: "Select Group…" },
      { id: "unselectGroup", label: "Unselect Group…" },
      { id: "selectAll", label: "Select All" },
      { id: "unselectAll", label: "Unselect All" },
      { id: "invert", label: "Invert Selection" },
    ],
  },
  {
    id: "commands",
    label: "Commands",
    items: [
      { id: "openConsole", label: "Open Command-Prompt" },
      { id: "search", label: "Search…" },
      { id: "syncDirs", label: "Synchronize Dirs…" },
      { id: "multiRename", label: "Multi-Rename Tool…" },
    ],
  },
  {
    id: "net",
    label: "Net",
    items: [
      { id: "ftpConnect", label: "FTP Connect…" },
      { id: "ftpNew", label: "FTP New Connection…" },
      { id: "ftpDisconnect", label: "FTP Disconnect" },
    ],
  },
  {
    id: "show",
    label: "Show",
    items: [
      { id: "brief", label: "Brief" },
      { id: "full", label: "Full" },
      { id: "tree", label: "Tree" },
      { id: "thumbnails", label: "Thumbnail View" },
      { id: "quickView", label: "Quick View Panel", separator: true },
    ],
  },
  {
    id: "config",
    label: "Configuration",
    items: [
      { id: "options", label: "Options…" },
      { id: "fileTypes", label: "File Types & Icons…" },
      { id: "buttonBar", label: "Change Button Bar…" },
    ],
  },
  {
    id: "start",
    label: "Start",
    items: [{ id: "calculator", label: "Calculator" }],
  },
  {
    id: "help",
    label: "Help",
    align: "right",
    items: [
      { id: "contents", label: "Contents" },
      { id: "about", label: "About…" },
    ],
  },
];

const nonFocusable = {
  tabIndex: -1,
  onMouseDown: (e: { preventDefault(): void }) => e.preventDefault(),
} as unknown as object;

export function MenuBar({ menus, onSelect }: MenuBarProps): JSX.Element {
  const [open, setOpen] = useState<string | null>(null);

  const leftMenus = menus.filter((m) => m.align !== "right");
  const rightMenus = menus.filter((m) => m.align === "right");

  const renderMenu = (m: MenuSpec): JSX.Element => (
    <View key={m.id} testID={`bc-menu-${m.id}`}>
      <Pressable
        onPress={() => setOpen((cur) => (cur === m.id ? null : m.id))}
        style={[styles.menu, open === m.id && styles.menuOpen]}
        testID={`bc-menu-${m.id}-trigger`}
        {...nonFocusable}
      >
        <Text style={styles.menuText}>{m.label}</Text>
      </Pressable>
      {open === m.id ? (
        <View style={styles.dropdown} testID={`bc-menu-${m.id}-dropdown`}>
          {m.items.map((it) => (
            <View key={it.id}>
              {it.separator ? <View style={styles.separator} /> : null}
              <Pressable
                disabled={it.disabled}
                onPress={() => {
                  setOpen(null);
                  onSelect?.(m.id, it.id);
                }}
                style={styles.dropdownItem}
                testID={`bc-menu-item-${m.id}-${it.id}`}
                {...nonFocusable}
              >
                <Text style={[styles.dropdownItemText, it.disabled && styles.disabled]}>
                  {it.label}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.bar} testID="bc-menubar">
      <View style={styles.row}>{leftMenus.map(renderMenu)}</View>
      <View style={styles.spacer} />
      <View style={styles.row}>{rightMenus.map(renderMenu)}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: tcTheme.color.chromeBg,
    borderBottomWidth: 1,
    borderBottomColor: tcTheme.color.chromeBorder,
    paddingHorizontal: 2,
    zIndex: 100,
  },
  row: {
    flexDirection: "row",
  },
  spacer: { flex: 1 },
  menu: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  menuOpen: {
    backgroundColor: tcTheme.color.cursorBgInactive,
  },
  menuText: {
    color: tcTheme.color.text,
    fontFamily: tcTheme.font.ui,
    fontSize: tcTheme.font.size,
  },
  dropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    minWidth: 180,
    backgroundColor: tcTheme.color.panelBg,
    borderWidth: 1,
    borderColor: tcTheme.color.chromeBorder,
    paddingVertical: 2,
    shadowColor: "#000",
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 2,
  },
  dropdownItem: {
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  dropdownItemText: {
    color: tcTheme.color.text,
    fontFamily: tcTheme.font.ui,
    fontSize: tcTheme.font.size,
  },
  disabled: {
    color: tcTheme.color.textDim,
  },
  separator: {
    height: 1,
    marginVertical: 2,
    backgroundColor: tcTheme.color.chromeBorder,
  },
});
