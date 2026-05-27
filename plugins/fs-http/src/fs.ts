import type { Capability } from "@bc/core";
import {
  buildUri,
  parentUri,
  parseUri,
  type DriveInfo,
  type FsEvent,
  type FsPlugin,
  type Stat,
  type Uri,
} from "@bc/vfs";

export interface HttpFsOptions {
  /** Base URL of the node-fs-server (e.g. http://127.0.0.1:7777). */
  baseUrl: string;
}

/**
 * VFS plugin backed by the node-fs-server. Wire format:
 *  - /list returns NDJSON, one `Stat` per line — yielded as the stream arrives.
 *  - /stat returns a single JSON object.
 *  - /read returns raw bytes (passed through as a ReadableStream).
 */
export class HttpFs implements FsPlugin {
  readonly scheme = "file";
  readonly capabilities: readonly Capability[] = [];

  private readonly baseUrl: string;

  constructor(opts: HttpFsOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
  }

  async *list(uri: Uri): AsyncIterable<Stat> {
    const url = `${this.baseUrl}/list?uri=${encodeURIComponent(uri)}`;
    const res = await fetch(url);
    if (!res.ok || !res.body) {
      throw new Error(`list ${uri}: HTTP ${res.status}`);
    }
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      // NDJSON: split on \n, keep the trailing partial line in `buf`.
      let nl = buf.indexOf("\n");
      while (nl >= 0) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (line.length > 0) yield JSON.parse(line) as Stat;
        nl = buf.indexOf("\n");
      }
    }
    if (buf.trim().length > 0) yield JSON.parse(buf) as Stat;
  }

  async stat(uri: Uri): Promise<Stat> {
    const url = `${this.baseUrl}/stat?uri=${encodeURIComponent(uri)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`stat ${uri}: HTTP ${res.status}`);
    return (await res.json()) as Stat;
  }

  /**
   * Observe a directory. Opens a long-lived NDJSON connection to /observe and
   * yields each event line. Cancellation comes via `signal`: aborting it
   * rejects the in-flight `reader.read()` immediately (which `.return()` on a
   * suspended async generator cannot do), closing the connection so the
   * server tears down its watcher.
   */
  async *observe(uri: Uri, signal?: AbortSignal): AsyncIterable<FsEvent> {
    const url = `${this.baseUrl}/observe?uri=${encodeURIComponent(uri)}`;
    const ctrl = new AbortController();
    const onAbort = (): void => ctrl.abort();
    if (signal) {
      if (signal.aborted) ctrl.abort();
      else signal.addEventListener("abort", onAbort, { once: true });
    }
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok || !res.body) throw new Error(`observe ${uri}: HTTP ${res.status}`);
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        let nl = buf.indexOf("\n");
        while (nl >= 0) {
          const line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.length > 0) yield JSON.parse(line) as FsEvent;
          nl = buf.indexOf("\n");
        }
      }
      if (buf.trim().length > 0) yield JSON.parse(buf) as FsEvent;
    } catch (err) {
      // Abort is the normal cancellation path, not an error.
      if ((err as { name?: string }).name === "AbortError") return;
      throw err;
    } finally {
      ctrl.abort();
      signal?.removeEventListener("abort", onAbort);
    }
  }

  /**
   * Drive root (e.g. file:///C:/) is the panel's "highest" navigable point;
   * going up stays put. Switching drives is the combo's job. The drives root
   * itself (file:///) maps to itself too — we suppress it from the file list
   * UI and reach it only via initial state.
   *
   * Also normalize the "would-produce-/C:" case to `/C:/` — bare `C:` on
   * Windows is drive-relative CWD, not drive root, so the server would list
   * whatever its process CWD is instead of the drive root.
   */
  parent(uri: Uri): Uri {
    const { scheme, path } = parseUri(uri);
    if (path === "/" || /^\/[A-Za-z]:\/?$/.test(path)) return uri;
    const parent = parseUri(parentUri(uri)).path;
    if (/^\/[A-Za-z]:$/.test(parent)) return buildUri(scheme, parent + "/");
    return parentUri(uri);
  }

  async drives(): Promise<readonly DriveInfo[]> {
    const res = await fetch(`${this.baseUrl}/drives`);
    if (!res.ok) throw new Error(`drives: HTTP ${res.status}`);
    return (await res.json()) as DriveInfo[];
  }

  /**
   * Random-access read via an HTTP Range request — the server responds 206
   * with just the slice (backed by a ranged file read), so only the requested
   * bytes cross the wire. If a server ignores Range and returns the whole file
   * (200), we slice client-side as a fallback.
   */
  async readRange(uri: Uri, offset: number, length: number): Promise<Uint8Array> {
    const url = `${this.baseUrl}/read?uri=${encodeURIComponent(uri)}`;
    const end = offset + length - 1;
    const res = await fetch(url, { headers: { Range: `bytes=${offset}-${end}` } });
    if (!res.ok && res.status !== 206) throw new Error(`readRange ${uri}: HTTP ${res.status}`);
    const buf = new Uint8Array(await res.arrayBuffer());
    if (res.status === 200 && buf.length > length) {
      return buf.subarray(offset, offset + length);
    }
    return buf;
  }

  read(uri: Uri): ReadableStream<Uint8Array> {
    const url = `${this.baseUrl}/read?uri=${encodeURIComponent(uri)}`;
    // Wrap in a fresh stream so we can defer the fetch until the consumer
    // starts pulling. Backpressure is preserved by piping reads through.
    return new ReadableStream<Uint8Array>({
      async start(controller) {
        const res = await fetch(url);
        if (!res.ok || !res.body) {
          controller.error(new Error(`read ${uri}: HTTP ${res.status}`));
          return;
        }
        const reader = res.body.getReader();
        for (;;) {
          const { value, done } = await reader.read();
          if (done) {
            controller.close();
            return;
          }
          controller.enqueue(value);
        }
      },
    });
  }
}
