import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { platform } from "node:os";
import { parseUri } from "./uri.js";
import { uriPathToFsPath } from "./fsmap.js";

/**
 * Windows file-icon extraction (Tier 2). Resolves the Explorer icon for a
 * cache key to a 16px PNG data URL via a single batched PowerShell run that
 * P/Invokes SHGetFileInfo:
 *   - `dir`            → system folder icon (SHGFI_USEFILEATTRIBUTES + DIRECTORY)
 *   - `ext:<.ext>`     → file-type icon, no real file needed (USEFILEATTRIBUTES)
 *   - `path:<uri>`     → the file's own icon (exe/lnk/ico embedded), real path
 *
 * Results are cached in memory by key; concurrent requests for the same key
 * share one extraction. Icons are Windows assets — kept only in memory / a
 * temp dir, never persisted into the repo.
 */

const IS_WINDOWS = platform() === "win32";
const cache = new Map<string, string>(); // key -> data URL ("" = known-unavailable)

interface Job {
  id: string;
  kind: "ext" | "dir" | "path";
  value: string; // ext (with dot) | "" | fs path
}

function keyToJob(key: string): Job | null {
  const id = createHash("sha1").update(key).digest("hex").slice(0, 16);
  if (key === "dir") return { id, kind: "dir", value: "" };
  if (key.startsWith("ext:")) return { id, kind: "ext", value: key.slice(4) || "." };
  if (key.startsWith("path:")) {
    const uri = key.slice(5);
    try {
      const { scheme, path } = parseUri(uri);
      if (scheme !== "file") return null;
      return { id, kind: "path", value: uriPathToFsPath(path) };
    } catch {
      return null;
    }
  }
  return null;
}

export async function resolveIcons(keys: readonly string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (!IS_WINDOWS) return out;

  const missing: { key: string; job: Job }[] = [];
  for (const key of keys) {
    const hit = cache.get(key);
    if (hit !== undefined) {
      if (hit) out[key] = hit;
      continue;
    }
    const job = keyToJob(key);
    if (!job) {
      cache.set(key, ""); // unsupported key — remember as unavailable
      continue;
    }
    missing.push({ key, job });
  }
  if (missing.length === 0) return out;

  const idToKey = new Map(missing.map((m) => [m.job.id, m.key]));
  const pngById = await extractBatch(missing.map((m) => m.job));
  for (const m of missing) {
    const png = pngById.get(m.job.id);
    const dataUrl = png ? `data:image/png;base64,${png}` : "";
    cache.set(m.key, dataUrl);
    if (dataUrl) out[m.key] = dataUrl;
  }
  void idToKey;
  return out;
}

async function extractBatch(jobs: Job[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (jobs.length === 0) return result;

  const work = await fs.mkdtemp(join(tmpdir(), "bc-icons-"));
  try {
    const jobsPath = join(work, "jobs.json");
    await fs.writeFile(jobsPath, JSON.stringify(jobs), "utf8");
    const mapJson = await runPowershell(buildScript(jobsPath, work));
    const map = JSON.parse(mapJson || "{}") as Record<string, string>;
    await Promise.all(
      Object.entries(map).map(async ([id, pngPath]) => {
        try {
          const buf = await fs.readFile(pngPath);
          result.set(id, buf.toString("base64"));
        } catch {
          /* skip unreadable */
        }
      }),
    );
  } finally {
    await fs.rm(work, { recursive: true, force: true }).catch(() => {});
  }
  return result;
}

function buildScript(jobsPath: string, outDir: string): string {
  // ConvertTo-Json on an empty hashtable emits nothing useful, so seed it.
  return `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class BcShell {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Auto)]
  public struct SHFILEINFO {
    public IntPtr hIcon; public int iIcon; public uint dwAttributes;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=260)] public string szDisplayName;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=80)]  public string szTypeName;
  }
  [DllImport("shell32.dll", CharSet=CharSet.Auto)]
  public static extern IntPtr SHGetFileInfo(string p, uint attr, ref SHFILEINFO i, uint cb, uint flags);
  [DllImport("user32.dll")] public static extern bool DestroyIcon(IntPtr h);
}
"@
$SHGFI_ICON=0x100; $SHGFI_SMALL=0x1; $SHGFI_USEATTR=0x10
$FILE_NORMAL=0x80; $FILE_DIR=0x10
$jobs = Get-Content -LiteralPath '${jobsPath}' -Raw | ConvertFrom-Json
$res = @{}
foreach ($j in $jobs) {
  $info = New-Object BcShell+SHFILEINFO
  $flags = $SHGFI_ICON -bor $SHGFI_SMALL
  if ($j.kind -eq 'ext') { $flags = $flags -bor $SHGFI_USEATTR; $path = 'x' + $j.value; $attr = $FILE_NORMAL }
  elseif ($j.kind -eq 'dir') { $flags = $flags -bor $SHGFI_USEATTR; $path = 'x'; $attr = $FILE_DIR }
  else { $path = $j.value; $attr = 0 }
  $size = [System.Runtime.InteropServices.Marshal]::SizeOf($info)
  [void][BcShell]::SHGetFileInfo($path, $attr, [ref]$info, $size, $flags)
  if ($info.hIcon -ne [IntPtr]::Zero) {
    try {
      $icon = [System.Drawing.Icon]::FromHandle($info.hIcon)
      $bmp = $icon.ToBitmap()
      $outFile = Join-Path '${outDir}' ($j.id + '.png')
      $bmp.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Png)
      $bmp.Dispose(); $icon.Dispose()
      $res[$j.id] = $outFile
    } catch {}
    [void][BcShell]::DestroyIcon($info.hIcon)
  }
}
ConvertTo-Json -InputObject $res -Compress
`;
}

function runPowershell(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
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
