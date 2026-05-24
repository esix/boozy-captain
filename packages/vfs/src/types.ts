import type { Capability } from "@bc/core";

export type Uri = string;

export type StatKind = "file" | "dir" | "symlink" | "special";

export interface Stat {
  name: string;
  uri: Uri;
  kind: StatKind;
  size: number;
  mtime: number;
  ctime?: number;
  exec?: boolean;
  hidden?: boolean;
  mime?: string;
}

export type DriveKind =
  | "local"
  | "removable"
  | "network"
  | "remote"
  | "cdrom"
  | "ramdisk"
  | "unknown";

export interface DriveInfo {
  /** Short display token shown in the combo (e.g. "C", "G", "/", "M"). */
  letter: string;
  /** Human-readable name (e.g. "Local Disk", "Google Drive"). */
  label: string;
  /** Stable URI to navigate to when the user picks this drive. */
  uri: Uri;
  kind: DriveKind;
}

export interface FsPlugin {
  readonly scheme: string;
  readonly capabilities: readonly Capability[];
  list(uri: Uri): AsyncIterable<Stat>;
  stat(uri: Uri): Promise<Stat>;
  read?(uri: Uri): ReadableStream<Uint8Array>;
  /**
   * Drives exposed by this plugin for the drive-bar combo. Schemes with no
   * drive concept (e.g. virtual / single-root filesystems) may omit this.
   */
  drives?(): Promise<readonly DriveInfo[]>;
  /**
   * Override the "go up" target. Returning the input URI signals
   * "this is a navigation root" — used to stop `[..]` from leaving a drive
   * root (e.g. file:///C:/ has no meaningful parent in the panel UX).
   * Defaults to the generic `parentUri()`.
   */
  parent?(uri: Uri): Uri;
}
