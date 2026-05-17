import { useMemo } from "react";
import type { FileListView, FileListViewProps } from "./types.js";

export interface FileListProps extends Omit<FileListViewProps, never> {
  view: FileListView;
}

/**
 * Thin shell that just delegates to the active view's Component.
 * Existence makes future per-view error boundaries / suspense fences easy
 * to add without touching every view implementation.
 */
export function FileList({ view, ...rest }: FileListProps): JSX.Element {
  const View = useMemo(() => view.Component, [view]);
  return <View {...rest} />;
}
