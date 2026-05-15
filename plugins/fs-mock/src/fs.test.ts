import { describe, it, expect } from "vitest";
import { MockFs } from "./fs.js";

describe("MockFs", () => {
  it("lists root", async () => {
    const fs = new MockFs({ delayMs: 0 });
    const names: string[] = [];
    for await (const stat of fs.list("mock:///")) {
      names.push(stat.name);
    }
    expect(names.sort()).toEqual(["etc", "home", "readme.txt"]);
  });

  it("lists nested", async () => {
    const fs = new MockFs({ delayMs: 0 });
    const names: string[] = [];
    for await (const stat of fs.list("mock:///home/user")) {
      names.push(stat.name);
    }
    expect(names.sort()).toEqual(["docs", "photos", "todo.md"]);
  });

  it("stats a file", async () => {
    const fs = new MockFs({ delayMs: 0 });
    const stat = await fs.stat("mock:///readme.txt");
    expect(stat.kind).toBe("file");
    expect(stat.name).toBe("readme.txt");
    expect(stat.size).toBeGreaterThan(0);
  });

  it("stats a directory", async () => {
    const fs = new MockFs({ delayMs: 0 });
    const stat = await fs.stat("mock:///home");
    expect(stat.kind).toBe("dir");
  });

  it("throws on missing paths", async () => {
    const fs = new MockFs({ delayMs: 0 });
    await expect(fs.stat("mock:///nope")).rejects.toThrow(/Not found/);
  });
});
