import { HostCapabilities } from "@bc/core";
import type { SurfaceManager } from "@bc/surfaces";
import { VfsRegistry } from "@bc/vfs";

export interface HostApi {
  readonly capabilities: HostCapabilities;
  readonly vfs: VfsRegistry;
  readonly surfaces: SurfaceManager;
}

export interface CreateHostOpts {
  capabilities: HostCapabilities;
  surfaces: SurfaceManager;
}

export function createHost({ capabilities, surfaces }: CreateHostOpts): HostApi {
  return {
    capabilities,
    surfaces,
    vfs: new VfsRegistry(),
  };
}
