// Usage: node tools/visual/shoot.mjs [name]
// Connects to the running Vite dev server, screenshots it, saves to tools/visual/shots/<name>.png.
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const URL = process.env.BC_URL ?? "http://localhost:5173/";
const name = process.argv[2] ?? "current";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "shots");
await mkdir(outDir, { recursive: true });
const out = path.join(outDir, `${name}.png`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("pageerror:", e.message));
page.on("console", (msg) => {
  if (msg.type() === "error") console.error("console.error:", msg.text());
});

await page.goto(URL, { waitUntil: "networkidle", timeout: 15000 });
// Give the streaming directory listing a moment to populate visible rows.
await page.waitForTimeout(800);

await page.screenshot({ path: out, fullPage: false });
console.log("saved", out);
await browser.close();
