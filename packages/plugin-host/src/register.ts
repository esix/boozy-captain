import type { HostApi } from "./host.js";
import { parseManifest, type BcManifest } from "./manifest.js";

export interface PluginModule {
  activate: (host: HostApi) => void | Promise<void>;
}

export interface PluginPackage {
  packageJson: { name?: string; bc?: unknown; boozy?: unknown };
  module: PluginModule;
}

export interface RegistrationResult {
  name: string;
  status: "activated" | "disabled";
  reason?: string;
  manifest: BcManifest;
}

export async function registerStatic(
  host: HostApi,
  pkg: PluginPackage,
): Promise<RegistrationResult> {
  const manifest = parseManifest(pkg.packageJson);
  const name = pkg.packageJson.name ?? "<unknown>";
  const required = manifest.requires ?? [];
  const missing = host.capabilities.missing(required);
  if (missing.length > 0) {
    return {
      name,
      status: "disabled",
      reason: `Missing capabilities: ${missing.join(", ")}`,
      manifest,
    };
  }
  await pkg.module.activate(host);
  return { name, status: "activated", manifest };
}
