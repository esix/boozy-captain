export type Capability =
  | "fs.read"
  | "fs.write"
  | "fs.watch"
  | "fs.symlink"
  | "fs.permissions"
  | "net.fetch"
  | "net.stream"
  | "net.ws"
  | "process.spawn"
  | "process.tty"
  | "clipboard.read"
  | "clipboard.write"
  | "dialog.native"
  | "crypto.subtle"
  | "storage.persistent";

export class HostCapabilities {
  private readonly set: ReadonlySet<Capability>;

  constructor(capabilities: readonly Capability[]) {
    this.set = new Set(capabilities);
  }

  has(c: Capability): boolean {
    return this.set.has(c);
  }

  hasAll(required: readonly Capability[]): boolean {
    return required.every((c) => this.set.has(c));
  }

  missing(required: readonly Capability[]): Capability[] {
    return required.filter((c) => !this.set.has(c));
  }
}
