import type { FsPlugin, Stat, Uri } from "./types.js";
import { parseUri } from "./uri.js";

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

  private resolve(uri: Uri): FsPlugin {
    const { scheme } = parseUri(uri);
    const p = this.plugins.get(scheme);
    if (!p) throw new Error(`No FS plugin for scheme: ${scheme}`);
    return p;
  }
}
