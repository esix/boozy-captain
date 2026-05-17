import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const URL = process.env.BC_URL ?? "http://localhost:5173/";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "shots");
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("pageerror:", e.message));
page.on("console", (m) => { if (m.type() === "error") console.error("console.error:", m.text()); });

await page.goto(URL, { waitUntil: "networkidle", timeout: 15000 });
await page.waitForTimeout(800);

// The right panel starts at mock:\home\user, so [photos] is directly visible.
// Double-click to navigate.
const photosRow = page.getByText("[photos]").first();
await photosRow.waitFor({ state: "visible", timeout: 5000 });
await photosRow.dblclick();

// Wait for the streaming list to populate (218 entries × 50ms = ~11s)
await page.waitForTimeout(12000);

await page.screenshot({ path: path.join(outDir, "brief-photos.png") });
console.log("saved brief-photos.png");

// Also screenshot at a smaller viewport to force multi-column overflow visible
await page.setViewportSize({ width: 1200, height: 600 });
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(outDir, "brief-photos-narrow.png") });
console.log("saved brief-photos-narrow.png");

await browser.close();
