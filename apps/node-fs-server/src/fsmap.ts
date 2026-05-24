import { promises as fs, type Stats } from "node:fs";
import { spawn } from "node:child_process";
import { platform } from "node:os";
import { buildUri } from "./uri.js";

// Mirror of @bc/vfs Stat — duplicated locally so the server has no workspace
// runtime deps. Keep field names in lock-step with packages/vfs/src/types.ts.
export interface WireStat {
  name: string;
  uri: string;
  kind: "file" | "dir" | "symlink" | "special";
  size: number;
  mtime: number;
  ctime?: number;
  exec?: boolean;
  hidden?: boolean;
}

const IS_WINDOWS = platform() === "win32";

/** Map a `file:///...` URI's path component to an OS filesystem path. */
export function uriPathToFsPath(uriPath: string): string {
  if (uriPath === "/" || uriPath === "") return IS_WINDOWS ? "" : "/";
  if (IS_WINDOWS) {
    // /C:/Users/esix → C:/Users/esix
    // /C: alone (without trailing slash) is *not* the drive root on Windows
    // — it's drive-relative CWD. Normalize to "C:/" so the server lists the
    // drive root regardless of how the client formed the URI.
    let mapped = uriPath.replace(/^\/([A-Za-z]:)/, "$1");
    if (/^[A-Za-z]:$/.test(mapped)) mapped += "/";
    return mapped;
  }
  return uriPath;
}

export function statToWire(name: string, uri: string, st: Stats): WireStat {
  let kind: WireStat["kind"];
  if (st.isDirectory()) kind = "dir";
  else if (st.isFile()) kind = "file";
  else if (st.isSymbolicLink()) kind = "symlink";
  else kind = "special";
  const w: WireStat = {
    name,
    uri,
    kind,
    size: st.size,
    mtime: st.mtimeMs,
    ctime: st.ctimeMs,
  };
  // POSIX heuristics: hidden if starts with '.', exec if any-x bit set.
  if (!IS_WINDOWS) {
    if (name.startsWith(".")) w.hidden = true;
    if (kind === "file" && (st.mode & 0o111) !== 0) w.exec = true;
  }
  return w;
}

/** True when the URI path points at the synthetic Windows "drives" root. */
export function isWindowsDrivesRoot(uriPath: string): boolean {
  return IS_WINDOWS && (uriPath === "/" || uriPath === "");
}

/** Synthetic drive listing: probe A:..Z: for accessible roots. */
export async function listWindowsDrives(): Promise<WireStat[]> {
  const out: WireStat[] = [];
  await Promise.all(
    Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)).map(async (letter) => {
      const root = `${letter}:/`;
      try {
        const st = await fs.stat(root);
        out.push({
          name: `${letter}:`,
          uri: buildUri("file", `/${letter}:/`),
          kind: "dir",
          size: 0,
          mtime: st.mtimeMs,
        });
      } catch {
        /* drive not present */
      }
    }),
  );
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

export interface WireDriveInfo {
  letter: string;
  label: string;
  uri: string;
  kind: "local" | "removable" | "network" | "remote" | "cdrom" | "ramdisk" | "unknown";
}

/**
 * Enumerate drives with labels + kinds.
 *
 *   - Windows: shell out to PowerShell `Get-Volume` for FileSystemLabel +
 *     DriveType, fall back to letter-only on failure.
 *   - POSIX: single synthetic root drive (mount points come later).
 */
export async function listDrives(): Promise<WireDriveInfo[]> {
  if (!IS_WINDOWS) {
    return [{ letter: "/", label: "/", uri: buildUri("file", "/"), kind: "local" }];
  }
  const stats = await listWindowsDrives();
  const labels = await readWindowsVolumeMeta().catch(() => new Map<string, { label: string; kind: WireDriveInfo["kind"] }>());
  return stats.map((s) => {
    const letter = s.name.replace(":", "");
    const meta = labels.get(letter.toUpperCase());
    return {
      letter,
      label: meta?.label ?? defaultDriveLabel(letter, meta?.kind ?? "local"),
      uri: s.uri,
      kind: meta?.kind ?? "local",
    };
  });
}

function defaultDriveLabel(letter: string, kind: WireDriveInfo["kind"]): string {
  switch (kind) {
    case "removable":
      return "Removable Disk";
    case "network":
      return "Network Drive";
    case "cdrom":
      return "CD-ROM";
    case "ramdisk":
      return "RAM Disk";
    default:
      return `Local Disk (${letter}:)`;
  }
}

// Win32_LogicalDisk.DriveType: 0 Unknown, 1 NoRoot, 2 Removable, 3 LocalDisk,
// 4 Network, 5 CompactDisc, 6 RAMDisk.
const DRIVE_TYPE_TO_KIND: Record<number, WireDriveInfo["kind"]> = {
  0: "unknown",
  2: "removable",
  3: "local",
  4: "network",
  5: "cdrom",
  6: "ramdisk",
};

async function readWindowsVolumeMeta(): Promise<Map<string, { label: string; kind: WireDriveInfo["kind"] }>> {
  // Win32_LogicalDisk surfaces VolumeName (the user-set friendly label, e.g.
  // "Google Drive", "sujes@mail.ru") and a numeric DriveType — both more
  // reliable than Get-Volume, which skips filter-driver mounts (Google Drive
  // etc.) and returns DriveType as a string enum. @() forces the cmdlet's
  // output into a list so single-volume systems still serialize as an array.
  const ps =
    "@(Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID,VolumeName,DriveType) | ConvertTo-Json -Compress";
  const stdout = await runPowershell(ps);
  const raw = JSON.parse(stdout) as
    | Array<{ DeviceID?: string; VolumeName?: string | null; DriveType?: number }>
    | { DeviceID?: string; VolumeName?: string | null; DriveType?: number };
  const list = Array.isArray(raw) ? raw : [raw];
  const out = new Map<string, { label: string; kind: WireDriveInfo["kind"] }>();
  for (const v of list) {
    if (!v.DeviceID) continue;
    const letter = v.DeviceID.replace(":", "").toUpperCase();
    const kind = DRIVE_TYPE_TO_KIND[v.DriveType ?? 0] ?? "local";
    const label = v.VolumeName && v.VolumeName.length > 0
      ? v.VolumeName
      : defaultDriveLabel(letter, kind);
    out.set(letter, { label, kind });
  }
  return out;
}

function runPowershell(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { windowsHide: true },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (b: Buffer) => (stdout += b.toString("utf8")));
    child.stderr.on("data", (b: Buffer) => (stderr += b.toString("utf8")));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`powershell exited ${code}: ${stderr.trim()}`));
    });
  });
}
