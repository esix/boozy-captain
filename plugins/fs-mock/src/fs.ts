import type { Capability } from "@bc/core";
import {
  type DriveInfo,
  type FsEvent,
  type FsPlugin,
  type Stat,
  type Uri,
  parseUri,
  buildUri,
  joinUri,
} from "@bc/vfs";
import { lookup, type MockDir, type MockNode } from "./fixtures.js";

const DEFAULT_DELAY_MS = 50;
const DEFAULT_WATCH_DEMO_MS = 4000;

export interface MockFsOptions {
  delayMs?: number;
  /** Interval for the synthetic watch demo (0 disables). */
  watchDemoMs?: number;
}

export class MockFs implements FsPlugin {
  readonly scheme = "mock";
  readonly capabilities: readonly Capability[] = [];

  private readonly delayMs: number;
  private readonly watchDemoMs: number;

  constructor(opts: MockFsOptions = {}) {
    this.delayMs = opts.delayMs ?? DEFAULT_DELAY_MS;
    this.watchDemoMs = opts.watchDemoMs ?? DEFAULT_WATCH_DEMO_MS;
  }

  async *list(uri: Uri): AsyncIterable<Stat> {
    const { path } = parseUri(uri);
    const node = lookup(path);
    if (!node) throw new Error(`Not found: ${uri}`);
    if (node.kind !== "dir") throw new Error(`Not a directory: ${uri}`);
    for (const [name, child] of Object.entries(node.children)) {
      if (this.delayMs > 0) await sleep(this.delayMs);
      yield toStat(name, child, joinUri(uri, name));
    }
  }

  async stat(uri: Uri): Promise<Stat> {
    const { path } = parseUri(uri);
    const node = lookup(path);
    if (!node) throw new Error(`Not found: ${uri}`);
    const name = path === "/" ? "/" : path.replace(/\/+$/, "").split("/").pop() ?? "/";
    return toStat(name, node, buildUri("mock", path));
  }

  async drives(): Promise<readonly DriveInfo[]> {
    return [{ letter: "M", label: "Mock Filesystem", uri: "mock:///", kind: "local" }];
  }

  /**
   * Initial scan (reusing list()) + `ready`, then a synthetic watch demo:
   * a "~live.tmp" file blinks in and out on a timer so directory-watching is
   * visible in the UI without touching a real disk. Cancelling the iterator
   * (panel navigates away) ends the loop.
   */
  async *observe(uri: Uri, signal?: AbortSignal): AsyncIterable<FsEvent> {
    for await (const stat of this.list(uri)) {
      if (signal?.aborted) return;
      yield { type: "add", stat };
    }
    yield { type: "ready" };
    if (this.watchDemoMs <= 0) return;
    const liveUri = joinUri(uri, "~live.tmp");
    let present = false;
    for (;;) {
      const slept = await waitOrAbort(this.watchDemoMs, signal);
      if (!slept) return; // aborted
      present = !present;
      if (present) {
        yield {
          type: "add",
          stat: { name: "~live.tmp", uri: liveUri, kind: "file", size: 1234, mtime: Date.now() },
        };
      } else {
        yield { type: "unlink", uri: liveUri };
      }
    }
  }
}

function toStat(name: string, node: MockNode, uri: Uri): Stat {
  if (node.kind === "dir") {
    return { name, uri, kind: "dir", size: 0, mtime: Date.now() };
  }
  return {
    name,
    uri,
    kind: "file",
    size: node.size,
    mtime: node.mtime,
    hidden: node.hidden,
    exec: node.exec,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Resolve true after `ms`, or false immediately when `signal` aborts. */
function waitOrAbort(ms: number, signal?: AbortSignal): Promise<boolean> {
  if (signal?.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve(true);
    }, ms);
    const onAbort = (): void => {
      clearTimeout(t);
      resolve(false);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

// Help the type checker realize MockDir is used (it's referenced via lookup's return)
export type { MockDir };
