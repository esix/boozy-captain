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

/**
 * Directory-observation event. A single ordered stream delivers the initial
 * scan (a run of `add`s) terminated by exactly one `ready`, then live changes.
 * Keeping scan + watch on one channel gives a clean "initial scan complete"
 * boundary AND guarantees a change/unlink can never precede the file's `add`.
 */
export type FsEvent =
  | { type: "add"; stat: Stat }
  | { type: "ready" }
  | { type: "change"; stat: Stat }
  | { type: "unlink"; uri: Uri }
  | { type: "rename"; from: Uri; stat: Stat };

export interface FsPlugin {
  readonly scheme: string;
  readonly capabilities: readonly Capability[];
  list(uri: Uri): AsyncIterable<Stat>;
  stat(uri: Uri): Promise<Stat>;
  read?(uri: Uri): ReadableStream<Uint8Array>;
  /**
   * Random-access read of `[offset, offset+length)`. Enables the lister to
   * view huge / network files instantly by fetching only the visible window.
   * Optional — schemes that can't seek (synthetic, streaming-only) omit it and
   * callers fall back to a buffered whole-file read.
   */
  readRange?(uri: Uri, offset: number, length: number): Promise<Uint8Array>;
  /**
   * Observe a directory: initial scan (`add`* then `ready`) followed by live
   * change events until aborted. The `signal` is the cancellation channel —
   * aborting it must promptly tear down any underlying resource (e.g. a
   * network read blocked waiting for the next event), which an async
   * iterator's `.return()` cannot do while suspended mid-`await`. Optional —
   * when a plugin omits it, VfsRegistry.observe() adapts list().
   */
  observe?(uri: Uri, signal?: AbortSignal): AsyncIterable<FsEvent>;
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
