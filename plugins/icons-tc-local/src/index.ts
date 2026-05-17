import type { HostApi } from "@bc/plugin-host";

/**
 * Loads toolbar / file-type icons from the *user's own* Total Commander install
 * at runtime. Nothing TC-related ships with BC — this plugin only reads files
 * the user already has on disk, on a target where the host advertises
 * `fs.read`.
 *
 * Compatibility: requires `fs.read` capability — auto-disabled in browser-pure
 * targets. Will be wired to a real FS plugin (`fs-node`) and to BC's icon
 * registry in a later slice; this scaffold just claims the plugin slot and
 * logs activation.
 */
export interface IconsTcLocalOptions {
  /** Path to the TC install dir. Defaults to "C:\\Program Files\\totalcmd". */
  installDir?: string;
}

export function activate(host: HostApi, opts: IconsTcLocalOptions = {}): void {
  const installDir = opts.installDir ?? "C:\\Program Files\\totalcmd";
  // The capability gate in @bc/plugin-host already verified fs.read is
  // available; the real implementation will use host.vfs to read icons from
  // `<installDir>\\WCMICONS.DLL` and friends, parse them, and register them
  // with an icon registry (added in a follow-up slice).
  console.log(`[icons-tc-local] activated; would scan ${installDir}\\WCMICONS.DLL`);
  void host;
}
