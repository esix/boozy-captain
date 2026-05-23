import { Children, isValidElement, type ReactNode } from "react";
import { MenuBar, type MenuItem as MenuBarItem, type MenuSpec } from "./MenuBar.js";

/**
 * Declarative JSX API for the app menu. Wraps the data-driven `MenuBar`.
 *
 * Usage:
 *   <AppMenu>
 *     <AppMenu.Menu title="Files">
 *       <AppMenu.Item title="Change Attributes…" onPress={() => …} />
 *       <AppMenu.Separator />
 *       <AppMenu.Item title="Exit" onPress={() => …} />
 *     </AppMenu.Menu>
 *     <AppMenu.Menu title="Help" align="end">
 *       <AppMenu.Item title="About…" onPress={() => …} />
 *     </AppMenu.Menu>
 *   </AppMenu>
 *
 * Each item carries its own `onPress`. `align="end"` anchors the menu's
 * dropdown to the right (used for the Help menu, TC-style).
 */

export interface AppMenuItemProps {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  /** Stable id (used in data-testid). Auto-derived from `title` if omitted. */
  id?: string;
}

export interface AppMenuMenuProps {
  title: string;
  /** "end" → dropdown anchors right (e.g. Help). */
  align?: "start" | "end";
  id?: string;
  children?: ReactNode;
}

export interface AppMenuProps {
  children: ReactNode;
}

// Marker components: never rendered directly. AppMenu harvests their props
// from the React children tree.
function AppMenuMenu(_props: AppMenuMenuProps): null {
  return null;
}
function AppMenuItem(_props: AppMenuItemProps): null {
  return null;
}
function AppMenuSeparator(): null {
  return null;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface ItemSpec {
  id: string;
  item: MenuBarItem;
  onPress?: () => void;
  pendingSeparator: boolean;
}

export function AppMenu({ children }: AppMenuProps): JSX.Element {
  // Build the data shape MenuBar expects, plus a dispatch map keyed by
  // `${menuId}.${itemId}` so onPress callbacks fire on selection.
  const menus: MenuSpec[] = [];
  const dispatch: Record<string, () => void> = {};

  Children.forEach(children, (child, mi) => {
    if (!isValidElement(child)) return;
    if (child.type !== AppMenuMenu) return;
    const props = child.props as AppMenuMenuProps;
    const menuId = props.id ?? (slugify(props.title) || `m${mi}`);

    // First pass: collect items + remember pending separators (which sit
    // *above* the next item, matching the MenuBar.MenuItem.separator flag).
    const collected: ItemSpec[] = [];
    let pendingSeparator = false;
    Children.forEach(props.children, (raw, ii) => {
      if (!isValidElement(raw)) return;
      if (raw.type === AppMenuSeparator) {
        pendingSeparator = true;
        return;
      }
      if (raw.type !== AppMenuItem) return;
      const itemProps = raw.props as AppMenuItemProps;
      const itemId = itemProps.id ?? (slugify(itemProps.title) || `i${ii}`);
      collected.push({
        id: itemId,
        item: {
          id: itemId,
          label: itemProps.title,
          disabled: itemProps.disabled,
          separator: pendingSeparator,
        },
        onPress: itemProps.onPress,
        pendingSeparator,
      });
      if (itemProps.onPress) dispatch[`${menuId}.${itemId}`] = itemProps.onPress;
      pendingSeparator = false;
    });

    menus.push({
      id: menuId,
      label: props.title,
      align: props.align === "end" ? "right" : "left",
      items: collected.map((c) => c.item),
    });
  });

  return (
    <MenuBar
      menus={menus}
      onSelect={(menuId, itemId) => {
        const fn = dispatch[`${menuId}.${itemId}`];
        fn?.();
      }}
    />
  );
}

AppMenu.Menu = AppMenuMenu;
AppMenu.Item = AppMenuItem;
AppMenu.Separator = AppMenuSeparator;
