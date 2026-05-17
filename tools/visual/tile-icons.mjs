// Tile icons matching a glob prefix into a single labeled sheet.
// Usage: node tools/visual/tile-icons.mjs <prefix> <out.png> [cols] [cell]
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";

const [prefix, out, colsArg, cellArg, suffixArg] = process.argv.slice(2);
if (!prefix || !out) {
  console.error("usage: node tile-icons.mjs <prefix> <out.png> [cols] [cell] [suffix=S|L]");
  process.exit(2);
}
const cols = Number(colsArg ?? 12);
const CELL = Number(cellArg ?? 48);
const sizeSuffix = suffixArg ?? "";

const dir = path.dirname(prefix);
const base = path.basename(prefix);
const allFiles = await readdir(dir);
const files = allFiles
  .filter((f) => f.startsWith(base) && f.endsWith(".png"))
  .filter((f) => (sizeSuffix ? f.endsWith(`_${sizeSuffix}.png`) : true))
  .sort();
if (files.length === 0) {
  console.error("no files");
  process.exit(1);
}

const PAD = 8;
const LABEL_H = 14;
const rows = Math.ceil(files.length / cols);
const W = cols * CELL + 20;
const H = rows * (CELL + LABEL_H) + 20;
const canvas = createCanvas(W, H);
const ctx = canvas.getContext("2d");
ctx.fillStyle = "#FFFFFF";
ctx.fillRect(0, 0, W, H);
ctx.font = "11px monospace";
ctx.textBaseline = "top";

for (let i = 0; i < files.length; i++) {
  const f = files[i];
  const col = i % cols;
  const row = Math.floor(i / cols);
  const x = 10 + col * CELL;
  const y = 10 + row * (CELL + LABEL_H);
  // Background per cell to highlight transparency boundaries
  ctx.fillStyle = "#F0F0F0";
  ctx.fillRect(x, y, CELL - 2, CELL - 2);
  try {
    const buf = await readFile(path.join(dir, f));
    const img = await loadImage(buf);
    // Draw centered, preserving aspect ratio, with up to (CELL-PAD) target size
    const target = CELL - PAD;
    const ratio = Math.min(target / img.width, target / img.height);
    const dw = Math.round(img.width * ratio);
    const dh = Math.round(img.height * ratio);
    const dx = x + Math.round((CELL - 2 - dw) / 2);
    const dy = y + Math.round((CELL - 2 - dh) / 2);
    ctx.drawImage(img, dx, dy, dw, dh);
  } catch {
    /* skip */
  }
  // Label: index extracted from filename like "wcmicons_03_S.png"
  const m = f.match(/_(\d+)_/);
  const idx = m ? m[1] : String(i);
  ctx.fillStyle = "#333333";
  ctx.fillText(idx, x + 2, y + CELL - 2);
}

await writeFile(out, canvas.toBuffer("image/png"));
console.log("saved", out, "files:", files.length, "size:", W, "x", H);
