import { briefView } from "./BriefView.js";
import { fullView } from "./FullView.js";
import type { FileListView } from "./types.js";

export class FileListViewRegistry {
  private readonly views = new Map<string, FileListView>();
  private order: string[] = [];

  register(view: FileListView): void {
    if (this.views.has(view.id)) {
      throw new Error(`FileListView already registered: ${view.id}`);
    }
    this.views.set(view.id, view);
    this.order.push(view.id);
  }

  get(id: string): FileListView | undefined {
    return this.views.get(id);
  }

  list(): readonly FileListView[] {
    return this.order.map((id) => this.views.get(id)!).filter(Boolean);
  }
}

/** Registry pre-populated with built-in views. */
export function createDefaultRegistry(): FileListViewRegistry {
  const r = new FileListViewRegistry();
  r.register(briefView);
  r.register(fullView);
  return r;
}
