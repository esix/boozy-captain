import type { DriveInfo, FsPlugin, Stat, Uri } from "./types.js";
import { parentUri, parseUri } from "./uri.js";

/**
 * One plugin's contribution to the aggregated drive list. Kept as discrete
 * groups (not flattened) so the UI can draw a horizontal separator between
 * plugins in the combo dropdown.
 */
export interface DriveGroup {
  scheme: string;
  drives: readonly DriveInfo[];
}

export class VfsRegistry {
  private readonly plugins = new Map<string, FsPlugin>();

  register(plugin: FsPlugin): void {
    if (this.plugins.has(plugin.scheme)) {
      throw new Error(`FS scheme already registered: ${plugin.scheme}`);
    }
    this.plugins.set(plugin.scheme, plugin);
  }

  has(scheme: string): boolean {
    return this.plugins.has(scheme);
  }

  list(uri: Uri): AsyncIterable<Stat> {
    return this.resolve(uri).list(uri);
  }

  stat(uri: Uri): Promise<Stat> {
    return this.resolve(uri).stat(uri);
  }

  /**
   * Plugin-aware "go up". Falls back to the generic `parentUri()` when the
   * plugin doesn't override. A return value equal to `uri` means "no parent"
   * — the panel UX uses this to suppress [..] at drive roots.
   */
  parent(uri: Uri): Uri {
    const p = this.resolve(uri);
    return p.parent ? p.parent(uri) : parentUri(uri);
  }

  /**
   * Ask every registered plugin for its drives. Plugin order = registration
   * order; an empty drives() result drops the group entirely. A plugin without
   * a drives() method contributes nothing (and that's fine — it's just not
   * reachable from the combo, only by typing its URI).
   */
  async drives(): Promise<DriveGroup[]> {
    const groups: DriveGroup[] = [];
    for (const [scheme, plugin] of this.plugins) {
      if (!plugin.drives) continue;
      const drives = await plugin.drives();
      if (drives.length > 0) groups.push({ scheme, drives });
    }
    return groups;
  }

  private resolve(uri: Uri): FsPlugin {
    const { scheme } = parseUri(uri);
    const p = this.plugins.get(scheme);
    if (!p) throw new Error(`No FS plugin for scheme: ${scheme}`);
    return p;
  }
}
