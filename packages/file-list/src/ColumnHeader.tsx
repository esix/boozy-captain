import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { tcTheme } from "@bc/theme";
import type { SortKey, SortSpec } from "./types.js";

const nonFocusableWebProps = {
  tabIndex: -1,
  onMouseDown: (e: { preventDefault(): void }) => e.preventDefault(),
} as unknown as object;

export interface ColumnDef {
  key: SortKey;
  label: string;
  /** flex value for sizing the body row cells (not used for the header). */
  flex: number;
  /** Right-align cell contents (size/date typical, body only). */
  alignRight?: boolean;
  /** Show this column at all (Brief omits Size/Date). */
  visible?: boolean;
  /** Direction used on the first click; subsequent clicks toggle. */
  defaultDirection?: "asc" | "desc";
}

export interface ColumnHeaderProps {
  columns: readonly ColumnDef[];
  sort: SortSpec;
  onChangeSort?: (sort: SortSpec) => void;
  /** Width of a leading fixed-width spacer (e.g. for the row's icon cell). */
  leadingWidth?: number;
}

// Per-column defaults: name/ext rise A→Z first, size/date fall biggest/newest first.
const DEFAULT_DIRECTION: Record<SortKey, "asc" | "desc"> = {
  name: "asc",
  ext: "asc",
  size: "desc",
  date: "desc",
};

export function ColumnHeader({ columns, sort, onChangeSort, leadingWidth }: ColumnHeaderProps): JSX.Element {
  return (
    <View style={styles.header}>
      {leadingWidth ? <View style={{ width: leadingWidth + 4 }} /> : null}
      {columns.map((c) => (
        <HeaderCell
          key={c.key}
          col={c}
          sort={sort}
          onChangeSort={onChangeSort}
        />
      ))}
    </View>
  );
}

function HeaderCell({
  col,
  sort,
  onChangeSort,
}: {
  col: ColumnDef;
  sort: SortSpec;
  onChangeSort?: (sort: SortSpec) => void;
}): JSX.Element {
  const isSorted = sort.key === col.key;
  const [hovered, setHovered] = useState(false);

  if (col.visible === false) {
    return <View style={styles.cell} />;
  }

  const arrow = isSorted ? (sort.direction === "asc" ? "↑" : "↓") : "";
  const bg = isSorted ? styles.cellActive : hovered ? styles.cellHover : null;
  return (
    <Pressable
      onPress={() => {
        if (isSorted) {
          onChangeSort?.({
            key: col.key,
            direction: sort.direction === "asc" ? "desc" : "asc",
          });
        } else {
          onChangeSort?.({
            key: col.key,
            direction: col.defaultDirection ?? DEFAULT_DIRECTION[col.key],
          });
        }
      }}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      {...nonFocusableWebProps}
      style={[styles.cell, bg]}
      testID={`bc-col-${col.key}`}
    >
      <Text style={styles.label} numberOfLines={1}>
        {arrow ? <Text style={styles.arrow}>{arrow}</Text> : null}
        {arrow ? " " : ""}
        {col.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    backgroundColor: tcTheme.color.panelBg,
    borderBottomWidth: 1,
    borderBottomColor: tcTheme.color.headerBorder,
  },
  cell: {
    flex: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: tcTheme.color.panelBg,
    borderRightWidth: 1,
    borderRightColor: tcTheme.color.headerBorder,
    // Web-only: arrow cursor on hover.
    cursor: "default",
  } as object,
  cellHover: {
    backgroundColor: "#E5EFFE",
  },
  cellActive: {
    backgroundColor: "#B8D6F5",
  },
  label: {
    color: tcTheme.color.headerText,
    fontFamily: tcTheme.font.ui,
    fontSize: tcTheme.font.size,
    textAlign: "left",
  },
  arrow: {
    fontWeight: "700",
    color: tcTheme.color.text,
  },
});
