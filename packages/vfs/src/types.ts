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

export interface FsPlugin {
  readonly scheme: string;
  readonly capabilities: readonly Capability[];
  list(uri: Uri): AsyncIterable<Stat>;
  stat(uri: Uri): Promise<Stat>;
  read?(uri: Uri): ReadableStream<Uint8Array>;
}
