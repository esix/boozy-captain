# Extracts every icon from a PE file (DLL/EXE) into PNGs.
# Usage: pwsh -File tools/visual/extract-icons.ps1 "<path-to-pe>" "<out-dir>"
param(
  [Parameter(Mandatory = $true)][string] $PePath,
  [Parameter(Mandatory = $true)][string] $OutDir
)

Add-Type -AssemblyName System.Drawing

$sig = @'
using System;
using System.Runtime.InteropServices;

public static class IconNative {
    [DllImport("shell32.dll", CharSet = CharSet.Auto)]
    public static extern int ExtractIconEx(
        string lpszFile, int nIconIndex,
        IntPtr[] phiconLarge, IntPtr[] phiconSmall, int nIcons);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool DestroyIcon(IntPtr hIcon);
}
'@

if (-not ([System.Management.Automation.PSTypeName]'IconNative').Type) {
  Add-Type -TypeDefinition $sig -Language CSharp
}

if (-not (Test-Path -LiteralPath $PePath)) {
  Write-Error "PE not found: $PePath"
  exit 2
}
if (-not (Test-Path -LiteralPath $OutDir)) {
  New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
}

$count = [IconNative]::ExtractIconEx($PePath, -1, $null, $null, 0)
Write-Host "icons in" $PePath ":" $count

if ($count -le 0) { exit 0 }

$nameBase = [System.IO.Path]::GetFileNameWithoutExtension($PePath).ToLower()
$digits   = ([string]$count).Length

for ($i = 0; $i -lt $count; $i++) {
  $large = New-Object 'IntPtr[]' 1
  $small = New-Object 'IntPtr[]' 1
  $ok = [IconNative]::ExtractIconEx($PePath, $i, $large, $small, 1)
  if ($ok -lt 1) { continue }

  foreach ($pair in @(@{ h = $large[0]; suffix = "L" }, @{ h = $small[0]; suffix = "S" })) {
    if ($pair.h -eq [IntPtr]::Zero) { continue }
    try {
      $icon = [System.Drawing.Icon]::FromHandle($pair.h)
      $bmp  = $icon.ToBitmap()
      $idx  = ([string]$i).PadLeft($digits, '0')
      $outPath = Join-Path $OutDir ("{0}_{1}_{2}.png" -f $nameBase, $idx, $pair.suffix)
      $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
      $bmp.Dispose()
      $icon.Dispose()
    } finally {
      [void][IconNative]::DestroyIcon($pair.h)
    }
  }
}

Write-Host "done -> $OutDir"
