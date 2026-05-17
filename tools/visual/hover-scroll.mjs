import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1200, height: 600 } });
const page = await ctx.newPage();
await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.getByText("[photos]").first().dblclick();
await page.waitForTimeout(6000);

// Move mouse over the right panel and scroll
await page.mouse.move(900, 400);
await page.waitForTimeout(200);
await page.mouse.wheel(100, 0); // horizontal scroll
await page.waitForTimeout(200);

await page.screenshot({ path: path.join(__dirname, "shots/hover-scroll.png") });
console.log("saved");
await browser.close();
