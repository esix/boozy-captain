import type { HostApi } from "@bc/plugin-host";
import { MockFs, type MockFsOptions } from "./fs.js";

export { MockFs, type MockFsOptions } from "./fs.js";

export function activate(host: HostApi, opts?: MockFsOptions): void {
  host.vfs.register(new MockFs(opts));
}
