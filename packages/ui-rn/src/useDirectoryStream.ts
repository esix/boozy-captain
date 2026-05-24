import { useEffect, useState } from "react";
import { pausable, type Pausable } from "@bc/core";
import type { FsEvent, Stat, Uri, VfsRegistry } from "@bc/vfs";

export interface DirectoryStreamState {
  entries: Stat[];
  loading: boolean;
  error: Error | null;
}

/** Apply one observe() event to the working entry buffer (mutates in place). */
function applyEvent(buf: Stat[], ev: FsEvent): void {
  switch (ev.type) {
    case "add":
    case "change": {
      const i = buf.findIndex((s) => s.uri === ev.stat.uri);
      if (i >= 0) buf[i] = ev.stat;
      else buf.push(ev.stat);
      return;
    }
    case "rename": {
      const i = buf.findIndex((s) => s.uri === ev.from);
      if (i >= 0) buf[i] = ev.stat;
      else buf.push(ev.stat);
      return;
    }
    case "unlink": {
      const i = buf.findIndex((s) => s.uri === ev.uri);
      if (i >= 0) buf.splice(i, 1);
      return;
    }
    case "ready":
      return;
  }
}

/**
 * Subscribe to a directory via VfsRegistry.observe(): the initial scan streams
 * `add` events (loading: true), `ready` flips loading false (the panel's
 * cursor-placement trigger), then live add/change/unlink/rename deltas mutate
 * the entry set while staying loading: false. The subscription is torn down
 * (and the underlying watcher closed) when the uri changes or on unmount.
 */
export function useDirectoryStream(vfs: VfsRegistry, uri: Uri): DirectoryStreamState & { reload: () => void } {
  const [state, setState] = useState<DirectoryStreamState>({
    entries: [],
    loading: true,
    error: null,
  });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let p: Pausable<FsEvent> | null = null;
    // Abort is the real teardown channel: it rejects a network read blocked
    // waiting for the next watch event. p.cancel() (iterator .return()) can't
    // do that while the generator is suspended mid-await, so without this the
    // /observe connection would leak and exhaust the browser's per-origin
    // connection pool.
    const ctrl = new AbortController();
    setState({ entries: [], loading: true, error: null });

    const run = async (): Promise<void> => {
      try {
        p = pausable(vfs.observe(uri, ctrl.signal));
        const buf: Stat[] = [];
        let ready = false;
        for await (const ev of p) {
          if (cancelled) return;
          applyEvent(buf, ev);
          if (ev.type === "ready") ready = true;
          // During the initial scan loading stays true; from `ready` on it is
          // false (the directory is "settled" even though the watch lives on).
          setState({ entries: [...buf], loading: !ready, error: null });
        }
        // Stream ended (fallback list adapter, or watcher closed): settle.
        if (!cancelled) setState({ entries: [...buf], loading: false, error: null });
      } catch (err) {
        // Abort is the normal cancellation path, not an error to surface.
        if (cancelled || (err as { name?: string }).name === "AbortError") return;
        setState((s) => ({ ...s, loading: false, error: err as Error }));
      }
    };

    void run();

    return () => {
      cancelled = true;
      ctrl.abort();
      p?.cancel();
    };
  }, [vfs, uri, tick]);

  return {
    ...state,
    reload: () => setTick((t) => t + 1),
  };
}
