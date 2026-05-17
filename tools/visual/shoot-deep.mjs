// Take screenshots that exercise more of the UI: navigate to photos folder
// and trigger quick search. Saves multiple shots.
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
page.on("console", (msg) => {
  if (msg.type() === "error") console.error("console.error:", msg.text());
});

await page.goto(URL, { waitUntil: "networkidle", timeout: 15000 });
await page.waitForTimeout(800);

// Screenshot 1: root view after polish
await page.screenshot({ path: path.join(outDir, "polished-root.png") });

// Screenshot 2: navigate left panel deep with arrow keys + Enter, get a many-rows view
await page.keyboard.press("ArrowDown");  // skip [..]
await page.keyboard.press("ArrowDown");  // skip readme
await page.keyboard.press("ArrowDown");  // license
await page.keyboard.press("ArrowDown");  // todo
await page.keyboard.press("ArrowDown");  // .env
await page.keyboard.press("Enter");      // [home]
await page.waitForTimeout(700);
await page.keyboard.press("Enter");      // [user]
await page.waitForTimeout(700);
// Cursor should now be on first row of /home/user (which is the [..] row).
// Move down to find [photos] and enter it
for (let i = 0; i < 12; i++) {
  await page.keyboard.press("ArrowDown");
}
await page.waitForTimeout(200);
await page.screenshot({ path: path.join(outDir, "polished-home-user.png") });

// Screenshot 3: quick search demo — type "pho"
await page.keyboard.type("pho", { delay: 80 });
await page.waitForTimeout(150);
await page.screenshot({ path: path.join(outDir, "polished-quicksearch.png") });

// Press Enter to drill into photos and see many rows
await page.keyboard.press("Escape");
await page.waitForTimeout(100);

await browser.close();
console.log("saved 3 screenshots");
