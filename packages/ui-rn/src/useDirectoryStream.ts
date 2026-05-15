import { useEffect, useState } from "react";
import { pausable, type Pausable } from "@bc/core";
import type { Stat, Uri, VfsRegistry } from "@bc/vfs";

export interface DirectoryStreamState {
  entries: Stat[];
  loading: boolean;
  error: Error | null;
}

export function useDirectoryStream(vfs: VfsRegistry, uri: Uri): DirectoryStreamState & { reload: () => void } {
  const [state, setState] = useState<DirectoryStreamState>({
    entries: [],
    loading: true,
    error: null,
  });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let p: Pausable<Stat> | null = null;
    setState({ entries: [], loading: true, error: null });

    const run = async (): Promise<void> => {
      try {
        const source = vfs.list(uri);
        p = pausable(source);
        const buf: Stat[] = [];
        for await (const stat of p) {
          if (cancelled) return;
          buf.push(stat);
          setState({ entries: [...buf], loading: true, error: null });
        }
        if (!cancelled) setState({ entries: buf, loading: false, error: null });
      } catch (err) {
        if (!cancelled) {
          setState((s) => ({ ...s, loading: false, error: err as Error }));
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      p?.cancel();
    };
  }, [vfs, uri, tick]);

  return {
    ...state,
    reload: () => setTick((t) => t + 1),
  };
}
