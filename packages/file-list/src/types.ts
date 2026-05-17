import type { ComponentType } from "react";
import type { Stat, Uri } from "@bc/vfs";

/** Synthetic parent-link row. The view renders this as `[..]`. */
export interface ParentRow {
  readonly kind: "parent";
  readonly uri: Uri;
}

/** A real filesystem entry, lifted to a row. */
export interface EntryRow {
  readonly kind: "entry";
  readonly stat: Stat;
}

export type Row = ParentRow | EntryRow;

export type SortKey = "name" | "ext" | "size" | "date";
export interface SortSpec {
  key: SortKey;
  direction: "asc" | "desc";
}

export interface FileListViewProps {
  rows: readonly Row[];
  cursor: number;
  marked: ReadonlySet<Uri>;
  focused: boolean;
  loading: boolean;
  sort: SortSpec;
  onCursorMove: (index: number) => void;
  onActivate: (row: Row) => void;
  onChangeSort?: (sort: SortSpec) => void;
  /** Right-click / long-press: toggle mark on the row at `index`. */
  onToggleMark?: (index: number) => void;
  /**
   * View reports its current horizontal stride — how many indices to jump when
   * the user presses ArrowLeft/Right. Brief = rowsPerCol; Full / single-column
   * views: 0 (no horizontal navigation).
   */
  onColumnStride?: (stride: number) => void;
}

export interface FileListView {
  /** Stable id, e.g. "brief", "full", "thumbnail". */
  readonly id: string;
  /** Display name shown in the view-mode switcher. */
  readonly label: string;
  /** The rendering component. */
  readonly Component: ComponentType<FileListViewProps>;
}
