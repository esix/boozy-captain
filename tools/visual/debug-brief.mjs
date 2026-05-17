import { chromium } from "playwright";

const URL = process.env.BC_URL ?? "http://localhost:5173/";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await ctx.newPage();

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(800);

const sample = await page.evaluate(() => {
  // Find the [Program Files] text and its parent chain widths
  const target = Array.from(document.querySelectorAll("*"))
    .find((el) => /^\[Program Fil/.test(el.textContent ?? ""));
  if (!target) return { error: "no [Program Files] found" };
  const chain = [];
  let el = target;
  for (let i = 0; i < 8 && el; i++) {
    const cs = window.getComputedStyle(el);
    chain.push({
      tag: el.tagName,
      class: el.className.toString().slice(0, 40),
      width: cs.width,
      flexBasis: cs.flexBasis,
      flexGrow: cs.flexGrow,
      flexShrink: cs.flexShrink,
      flexDirection: cs.flexDirection,
      alignSelf: cs.alignSelf,
    });
    el = el.parentElement;
  }
  return { chain };
});
console.log(JSON.stringify(sample, null, 2));
await browser.close();
