import type { Stats } from "node:fs";
import { basename, resolve as resolvePath } from "node:path";
import chokidar, { type FSWatcher } from "chokidar";
import { buildUri } from "./uri.js";
import { statToWire, type WireStat } from "./fsmap.js";

export type WatchEvent =
  | { type: "add"; stat: WireStat }
  | { type: "ready" }
  | { type: "change"; stat: WireStat }
  | { type: "unlink"; uri: string };

type Send = (ev: WatchEvent) => void;

/**
 * One chokidar watcher per directory, shared by all observers (panels) of that
 * path. Two watchers on the same path share OS watch state and stomp on each
 * other (closing one makes the other emit spurious unlinks), so we fan a
 * single watcher's events out to every subscriber and close it only when the
 * last subscriber leaves. New subscribers get the current snapshot replayed as
 * `add`s (+ `ready` if the scan already finished) so they don't miss the
 * initial listing that chokidar already fired.
 */
class DirWatch {
  private readonly watcher: FSWatcher;
  private readonly entries = new Map<string, WireStat>(); // child uri -> stat
  private ready = false;
  private readonly subs = new Set<Send>();
  private readonly rootResolved: string;

  constructor(
    fsPath: string,
    private readonly uriPath: string,
    private readonly onEmpty: () => void,
  ) {
    this.rootResolved = resolvePath(fsPath);
    this.watcher = chokidar.watch(fsPath, {
      depth: 0,
      ignoreInitial: false,
      alwaysStat: true,
      ignorePermissionErrors: true,
    });
    this.watcher
      .on("add", (full, st) => this.upsert("add", full, st))
      .on("addDir", (full, st) => {
        if (resolvePath(full) !== this.rootResolved) this.upsert("add", full, st);
      })
      .on("change", (full, st) => this.upsert("change", full, st))
      .on("unlink", (full) => this.remove(full))
      .on("unlinkDir", (full) => this.remove(full))
      .on("ready", () => {
        this.ready = true;
        this.broadcast({ type: "ready" });
      })
      .on("error", (err) => {
        process.stderr.write(
          `watch error (${this.uriPath}): ${err instanceof Error ? err.message : String(err)}\n`,
        );
      });
  }

  private childUri(full: string): string {
    const name = basename(full);
    const p = this.uriPath.endsWith("/") ? this.uriPath + name : `${this.uriPath}/${name}`;
    return buildUri("file", p);
  }

  private upsert(type: "add" | "change", full: string, st?: Stats): void {
    if (!st) return;
    const uri = this.childUri(full);
    const stat = statToWire(basename(full), uri, st);
    this.entries.set(uri, stat);
    this.broadcast({ type, stat });
  }

  private remove(full: string): void {
    const uri = this.childUri(full);
    this.entries.delete(uri);
    this.broadcast({ type: "unlink", uri });
  }

  private broadcast(ev: WatchEvent): void {
    for (const send of this.subs) send(ev);
  }

  /** Replay the snapshot to a new subscriber, then stream live events. */
  subscribe(send: Send): () => void {
    // Synchronous (no await) so a chokidar callback can't interleave between
    // the snapshot replay and registration — no missed or duplicated events.
    for (const stat of this.entries.values()) send({ type: "add", stat });
    if (this.ready) send({ type: "ready" });
    this.subs.add(send);
    return () => {
      this.subs.delete(send);
      if (this.subs.size === 0) {
        void this.watcher.close();
        this.onEmpty();
      }
    };
  }
}

const watches = new Map<string, DirWatch>();

/**
 * Subscribe to directory events, sharing one watcher per resolved path.
 * Returns an unsubscribe function that closes the watcher when no subscribers
 * remain.
 */
export function subscribeDir(fsPath: string, uriPath: string, send: Send): () => void {
  const key = resolvePath(fsPath);
  let w = watches.get(key);
  if (!w) {
    w = new DirWatch(fsPath, uriPath, () => watches.delete(key));
    watches.set(key, w);
  }
  return w.subscribe(send);
}
