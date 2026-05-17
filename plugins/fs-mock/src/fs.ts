import type { Capability } from "@bc/core";
import { type FsPlugin, type Stat, type Uri, parseUri, buildUri, joinUri } from "@bc/vfs";
import { lookup, type MockDir, type MockNode } from "./fixtures.js";

const DEFAULT_DELAY_MS = 50;

export interface MockFsOptions {
  delayMs?: number;
}

export class MockFs implements FsPlugin {
  readonly scheme = "mock";
  readonly capabilities: readonly Capability[] = [];

  private readonly delayMs: number;

  constructor(opts: MockFsOptions = {}) {
    this.delayMs = opts.delayMs ?? DEFAULT_DELAY_MS;
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

// Help the type checker realize MockDir is used (it's referenced via lookup's return)
export type { MockDir };
