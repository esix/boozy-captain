import { chromium } from "playwright";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1200, height: 600 } });
const page = await ctx.newPage();
await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.getByText("[photos]").first().dblclick();
await page.waitForTimeout(6000);

const info = await page.evaluate(() => {
  // Find an element with overflow scroll/auto
  const scrollers = Array.from(document.querySelectorAll("div")).filter((d) => {
    const cs = window.getComputedStyle(d);
    return (
      (cs.overflowX === "scroll" || cs.overflowX === "auto") &&
      d.scrollWidth > d.clientWidth
    );
  });
  // Sample one
  const result = scrollers.slice(0, 3).map((d) => {
    const cs = window.getComputedStyle(d);
    return {
      scrollWidth: d.scrollWidth,
      clientWidth: d.clientWidth,
      offsetHeight: d.offsetHeight,
      clientHeight: d.clientHeight,
      scrollbarH: d.offsetHeight - d.clientHeight,
      overflowX: cs.overflowX,
      overflowY: cs.overflowY,
      scrollbarWidth: cs.scrollbarWidth,
    };
  });
  // Stylesheet check — search all sheets
  const allScrollbarRules = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        if (/scrollbar/i.test(rule.cssText)) {
          allScrollbarRules.push(rule.cssText);
        }
      }
    } catch {
      /* cross-origin */
    }
  }
  return { result, allScrollbarRules };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
