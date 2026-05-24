import type { HostApi } from "@bc/plugin-host";
import { HttpFs, type HttpFsOptions } from "./fs.js";

export { HttpFs, type HttpFsOptions } from "./fs.js";

export function activate(host: HostApi, opts: HttpFsOptions): void {
  host.vfs.register(new HttpFs(opts));
}
