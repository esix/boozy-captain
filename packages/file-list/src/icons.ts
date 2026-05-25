import { createContext, useContext, useEffect, useSyncExternalStore } from "react";
import { parseUri, type Stat, type Uri } from "@bc/vfs";

/**
 * OS file-icon resolution (Tier 2). The host (web → node-fs-server) extracts
 * real Explorer icons; this client cache dedups by a coarse key so a 1000-file
 * dir collapses to a handful of fetches, batches lookups into one round-trip,
 * and notifies only the rows whose key resolved. RowIcon shows the bundled
 * Lucide glyph until/unless an OS icon arrives.
 *
 * Keys (cache granularity):
 *   - "dir"           one shared folder icon
 *   - "ext:.<ext>"    one icon per file type (most files)
 *   - "path:<uri>"    per-file icon for files whose icon is embedded in the
 *                     file itself (exe/lnk/ico) or the bundle (macOS .app)
 */

const PER_FILE_EXT = new Set(["exe", "lnk", "ico"]);

/** Cache key for a stat, or null when no OS icon should be requested. */
export function iconKeyForStat(stat: Stat): string | null {
  if (stat.kind === "dir") {
    // macOS .app bundles are directories, but each carries its own icon — so
    // resolve them per-path (like exe/lnk) rather than as a generic folder.
    if (schemeOf(stat.uri) === "file" && /\.app$/i.test(stat.name)) {
      return `path:${stat.uri}`;
    }
    return "dir";
  }
  if (stat.kind !== "file") return null;
  const dot = stat.name.lastIndexOf(".");
  const ext = dot > 0 ? stat.name.slice(dot + 1).toLowerCase() : "";
  if (ext && PER_FILE_EXT.has(ext) && schemeOf(stat.uri) === "file") {
    return `path:${stat.uri}`;
  }
  return ext ? `ext:.${ext}` : "ext:";
}

function schemeOf(uri: Uri): string {
  try {
    return parseUri(uri).scheme;
  } catch {
    return "";
  }
}

export type IconFetcher = (keys: string[]) => Promise<Record<string, string>>;

/**
 * Per-key icon cache with debounced batch fetching. "" stored for a key means
 * "resolved, no icon available" (so we don't refetch); absent means unknown.
 */
export class IconCache {
  private readonly resolved = new Map<string, string>();
  private readonly listeners = new Map<string, Set<() => void>>();
  private readonly queue = new Set<string>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly fetcher: IconFetcher,
    private readonly batchDelayMs = 16,
  ) {}

  /** Cached value: a data URL, "" (unavailable), or undefined (unknown yet). */
  peek(key: string): string | undefined {
    return this.resolved.get(key);
  }

  subscribe(key: string, cb: () => void): () => void {
    let set = this.listeners.get(key);
    if (!set) {
      set = new Set();
      this.listeners.set(key, set);
    }
    set.add(cb);
    return () => {
      set!.delete(cb);
      if (set!.size === 0) this.listeners.delete(key);
    };
  }

  /** Queue a key for resolution if not already known/in-flight. */
  request(key: string): void {
    if (this.resolved.has(key) || this.queue.has(key)) return;
    this.queue.add(key);
    if (this.flushTimer === null) {
      this.flushTimer = setTimeout(() => void this.flush(), this.batchDelayMs);
    }
  }

  private async flush(): Promise<void> {
    this.flushTimer = null;
    const keys = [...this.queue];
    this.queue.clear();
    if (keys.length === 0) return;
    let map: Record<string, string> = {};
    try {
      map = await this.fetcher(keys);
    } catch {
      /* leave unknown; a later request retries */
    }
    for (const key of keys) {
      // Keys not present in the response resolved to "no icon".
      this.resolved.set(key, map[key] ?? "");
      this.notify(key);
    }
  }

  private notify(key: string): void {
    const set = this.listeners.get(key);
    if (set) for (const cb of set) cb();
  }
}

export const IconContext = createContext<IconCache | null>(null);

/**
 * Resolve an OS icon URL for a cache key. Returns the data URL once available,
 * else null (caller falls back to the glyph). No-op when there is no provider
 * or no key.
 */
export function useFileIcon(key: string | null): string | null {
  const cache = useContext(IconContext);

  const url = useSyncExternalStore(
    (cb) => (cache && key ? cache.subscribe(key, cb) : () => {}),
    () => (cache && key ? cache.peek(key) : undefined),
  );

  useEffect(() => {
    if (cache && key && cache.peek(key) === undefined) cache.request(key);
  }, [cache, key]);

  return url ? url : null;
}
