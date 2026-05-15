import { HostCapabilities } from "@bc/core";
import { VfsRegistry } from "@bc/vfs";

export interface HostApi {
  readonly capabilities: HostCapabilities;
  readonly vfs: VfsRegistry;
}

export function createHost(capabilities: HostCapabilities): HostApi {
  return {
    capabilities,
    vfs: new VfsRegistry(),
  };
}
