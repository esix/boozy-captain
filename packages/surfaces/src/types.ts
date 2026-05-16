import type { ReactNode } from "react";

export type SurfaceKind = "modal" | "window" | "sheet" | "pill";

export interface SurfaceHandle {
  readonly id: string;
  readonly kind: SurfaceKind;
  close(): void;
  focus(): void;
  changeKind(kind: SurfaceKind): void;
}

/** A surface's content. Receives its own handle so it can self-close. */
export type SurfaceContent = (props: { handle: SurfaceHandle }) => ReactNode;

export interface SurfaceOptions {
  kind: SurfaceKind;
  title?: string;
  /** Called after the surface is closed. */
  onClose?: () => void;
  /** Initial position hint for `window` kind (web/desktop). */
  position?: { x?: number; y?: number; width?: number; height?: number };
}

export interface SurfaceManager {
  open(content: SurfaceContent, options: SurfaceOptions): SurfaceHandle;
  list(): readonly SurfaceHandle[];
  get(id: string): SurfaceHandle | undefined;
}

/** Each open surface as observed by a renderer. */
export interface SurfaceEntry {
  readonly handle: SurfaceHandle;
  readonly content: SurfaceContent;
  readonly options: SurfaceOptions;
}
