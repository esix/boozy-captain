import { createReadStream, promises as fs } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { join as posixJoin } from "node:path/posix";
import { parseUri, buildUri } from "./uri.js";
import {
  isWindowsDrivesRoot,
  listDrives,
  statToWire,
  uriPathToFsPath,
  type WireStat,
} from "./fsmap.js";
import { subscribeDir } from "./watch.js";
import { resolveIcons } from "./icons.js";

export interface StartServerOpts {
  host?: string;
  port?: number;
  /** Origin allowed by CORS. Pass `*` for any (dev only). */
  corsOrigin?: string;
}

export interface RunningServer {
  url: string;
  close(): Promise<void>;
}

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 7777;
const DEFAULT_CORS = "http://localhost:5173";

export async function startServer(opts: StartServerOpts = {}): Promise<RunningServer> {
  const host = opts.host ?? DEFAULT_HOST;
  const port = opts.port ?? DEFAULT_PORT;
  const corsOrigin = opts.corsOrigin ?? DEFAULT_CORS;

  const server = createServer((req, res) => {
    setCors(res, corsOrigin);
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    handle(req, res)
      .then((handled) => {
        if (!handled) json(res, 404, { error: "Not found" });
      })
      .catch((err) => respondWithError(res, err));
  });

  await new Promise<void>((resolve) => server.listen(port, host, resolve));
  return {
    url: `http://${host}:${port}`,
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}

/**
 * Connect-style middleware. Mount under a prefix (e.g. `/_fs`) — connect
 * strips the prefix from `req.url` before invoking, so the inner switch sees
 * `/list`, `/stat`, etc. unchanged. Calls `next` for non-matching paths so
 * the Vite stack can keep dispatching.
 */
export function fsMiddleware(): (
  req: IncomingMessage,
  res: ServerResponse,
  next: (err?: unknown) => void,
) => void {
  return (req, res, next) => {
    handle(req, res)
      .then((handled) => {
        if (!handled) next();
      })
      .catch((err) => respondWithError(res, err));
  };
}

/** Returns true if a route matched (response written); false to delegate. */
export async function handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://localhost");
  switch (url.pathname) {
    case "/health":
      json(res, 200, { ok: true });
      return true;
    case "/list":
      await handleList(res, requireUri(url));
      return true;
    case "/stat":
      await handleStat(res, requireUri(url));
      return true;
    case "/read":
      await handleRead(res, requireUri(url));
      return true;
    case "/drives":
      json(res, 200, await listDrives());
      return true;
    case "/observe":
      handleObserve(req, res, requireUri(url));
      return true;
    case "/icons": {
      const keys = (url.searchParams.get("keys") ?? "").split(",").filter((k) => k.length > 0);
      json(res, 200, await resolveIcons(keys));
      return true;
    }
    default:
      return false;
  }
}

function respondWithError(res: ServerResponse, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  if (!res.headersSent) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: msg }));
  } else {
    res.end();
  }
}

function requireUri(url: URL): string {
  const u = url.searchParams.get("uri");
  if (!u) throw new Error("Missing ?uri=");
  return u;
}

async function handleList(res: ServerResponse, uri: string): Promise<void> {
  const { scheme, path: uriPath } = parseUri(uri);
  if (scheme !== "file") throw new Error(`Unsupported scheme: ${scheme}`);

  res.writeHead(200, {
    "Content-Type": "application/x-ndjson; charset=utf-8",
    "Cache-Control": "no-store",
  });

  if (isWindowsDrivesRoot(uriPath)) {
    // Drives only come from /drives now; the file panel UI doesn't render
    // them as rows. Returning an empty NDJSON stream means navigating to
    // file:/// shows an empty panel — but the panel never actually does
    // (parent stops at drive root, combo handles drive switching).
    res.end();
    return;
  }

  const fsPath = uriPathToFsPath(uriPath);
  const dir = await fs.opendir(fsPath);
  // opendir streams entries; emit one NDJSON line per entry without buffering.
  for await (const entry of dir) {
    const childUriPath = uriPath.endsWith("/") ? uriPath + entry.name : `${uriPath}/${entry.name}`;
    const childUri = buildUri("file", childUriPath);
    const childFsPath = posixJoin(fsPath, entry.name);
    let wire: WireStat;
    try {
      const st = await fs.lstat(childFsPath);
      wire = statToWire(entry.name, childUri, st);
    } catch {
      wire = { name: entry.name, uri: childUri, kind: "special", size: 0, mtime: 0 };
    }
    res.write(JSON.stringify(wire) + "\n");
  }
  res.end();
}

async function handleStat(res: ServerResponse, uri: string): Promise<void> {
  const { scheme, path: uriPath } = parseUri(uri);
  if (scheme !== "file") throw new Error(`Unsupported scheme: ${scheme}`);
  if (isWindowsDrivesRoot(uriPath)) {
    return json(res, 200, {
      name: "/",
      uri: buildUri("file", "/"),
      kind: "dir",
      size: 0,
      mtime: 0,
    } satisfies WireStat);
  }
  const fsPath = uriPathToFsPath(uriPath);
  const st = await fs.lstat(fsPath);
  const name = uriPath === "/" ? "/" : uriPath.replace(/\/+$/, "").split("/").pop() ?? "/";
  return json(res, 200, statToWire(name, uri, st));
}

/**
 * Stream directory-observation events as NDJSON over a long-lived connection.
 * Backed by a per-path shared watcher (see watch.ts): the subscriber receives
 * the current snapshot (add* + ready) then live changes. Unsubscribes when the
 * client disconnects, which closes the watcher once the last observer leaves.
 */
function handleObserve(req: IncomingMessage, res: ServerResponse, uri: string): void {
  const { scheme, path: uriPath } = parseUri(uri);
  if (scheme !== "file") throw new Error(`Unsupported scheme: ${scheme}`);

  res.writeHead(200, {
    "Content-Type": "application/x-ndjson; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Accel-Buffering": "no", // disable proxy buffering so events flush live
  });
  const send = (ev: unknown): void => {
    if (!res.writableEnded) res.write(JSON.stringify(ev) + "\n");
  };
  const end = (): void => {
    if (!res.writableEnded) res.end();
  };

  // The Windows drive-list root has no real directory to watch.
  if (isWindowsDrivesRoot(uriPath)) {
    send({ type: "ready" });
    return; // connection stays open; client closes it on navigate-away
  }

  const fsPath = uriPathToFsPath(uriPath);
  const unsubscribe = subscribeDir(fsPath, uriPath, { send, end });
  // req and res both emit "close"; run unsubscribe exactly once so a late
  // second call can't tear down a watcher a new subscriber just recreated.
  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    unsubscribe();
  };
  req.on("close", close);
  res.on("close", close);
}

async function handleRead(res: ServerResponse, uri: string): Promise<void> {
  const { scheme, path: uriPath } = parseUri(uri);
  if (scheme !== "file") throw new Error(`Unsupported scheme: ${scheme}`);
  const fsPath = uriPathToFsPath(uriPath);
  const st = await fs.stat(fsPath);
  res.writeHead(200, {
    "Content-Type": "application/octet-stream",
    "Content-Length": String(st.size),
    "Cache-Control": "no-store",
  });
  createReadStream(fsPath).pipe(res);
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function setCors(res: ServerResponse, origin: string): void {
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
}
