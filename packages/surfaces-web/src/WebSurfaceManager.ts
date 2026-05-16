import type {
  SurfaceContent,
  SurfaceEntry,
  SurfaceHandle,
  SurfaceKind,
  SurfaceManager,
  SurfaceOptions,
} from "@bc/surfaces";

type Listener = () => void;

/**
 * In-process surface manager for web/Electron renderer. Holds the list of
 * open surfaces; subscribers (the SurfaceLayer component) re-render on
 * change.
 *
 * For `window` kind in T1 (web-static) we render an in-app floating panel.
 * Real `BrowserWindow` separation belongs in @bc/surfaces-electron.
 */
export class WebSurfaceManager implements SurfaceManager {
  private nextId = 1;
  private readonly entries = new Map<string, SurfaceEntry>();
  private readonly listeners = new Set<Listener>();
  /**
   * Cached snapshot — must keep stable identity across `getSnapshot` calls
   * for React's `useSyncExternalStore` to avoid an infinite render loop.
   * Rebuilt only on mutation.
   */
  private snapshot: readonly SurfaceEntry[] = [];

  open(content: SurfaceContent, options: SurfaceOptions): SurfaceHandle {
    const id = `s${this.nextId++}`;
    const handle: SurfaceHandle = {
      id,
      kind: options.kind,
      close: () => this.close(id),
      focus: () => this.focus(id),
      changeKind: (k) => this.changeKind(id, k),
    };
    this.entries.set(id, { handle, content, options });
    this.rebuildSnapshot();
    return handle;
  }

  list(): readonly SurfaceHandle[] {
    return this.snapshot.map((e) => e.handle);
  }

  get(id: string): SurfaceHandle | undefined {
    return this.entries.get(id)?.handle;
  }

  entriesSnapshot(): readonly SurfaceEntry[] {
    return this.snapshot;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private close(id: string): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    this.entries.delete(id);
    entry.options.onClose?.();
    this.rebuildSnapshot();
  }

  private focus(id: string): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    // Move to end (rendered last → on top)
    this.entries.delete(id);
    this.entries.set(id, entry);
    this.rebuildSnapshot();
  }

  private changeKind(id: string, kind: SurfaceKind): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    const newHandle: SurfaceHandle = { ...entry.handle, kind };
    this.entries.set(id, { ...entry, handle: newHandle, options: { ...entry.options, kind } });
    this.rebuildSnapshot();
  }

  private rebuildSnapshot(): void {
    this.snapshot = Array.from(this.entries.values());
    for (const l of this.listeners) l();
  }
}
