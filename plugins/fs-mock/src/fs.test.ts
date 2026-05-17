import { describe, it, expect } from "vitest";
import { MockFs } from "./fs.js";

async function listAll(fs: MockFs, uri: string): Promise<string[]> {
  const names: string[] = [];
  for await (const stat of fs.list(uri)) names.push(stat.name);
  return names;
}

describe("MockFs", () => {
  it("lists root and includes expected entries", async () => {
    const fs = new MockFs({ delayMs: 0 });
    const names = await listAll(fs, "mock:///");
    expect(names).toEqual(expect.arrayContaining(["home", "etc", "readme.txt"]));
    expect(names.length).toBeGreaterThanOrEqual(8);
  });

  it("lists a deep directory with many entries", async () => {
    const fs = new MockFs({ delayMs: 0 });
    const photos = await listAll(fs, "mock:///home/user/photos");
    expect(photos.length).toBe(218);
    expect(photos[0]).toMatch(/^Photo_\d+\.jpg$/);
  });

  it("is deterministic across instances", async () => {
    const a = await listAll(new MockFs({ delayMs: 0 }), "mock:///home/user/downloads");
    const b = await listAll(new MockFs({ delayMs: 0 }), "mock:///home/user/downloads");
    expect(a).toEqual(b);
    expect(a.length).toBe(140);
  });

  it("stats files and dirs", async () => {
    const fs = new MockFs({ delayMs: 0 });
    expect((await fs.stat("mock:///readme.txt")).kind).toBe("file");
    expect((await fs.stat("mock:///home")).kind).toBe("dir");
  });

  it("propagates hidden flag", async () => {
    const fs = new MockFs({ delayMs: 0 });
    const env = await fs.stat("mock:///.env");
    expect(env.hidden).toBe(true);
  });

  it("throws on missing paths", async () => {
    const fs = new MockFs({ delayMs: 0 });
    await expect(fs.stat("mock:///nope")).rejects.toThrow(/Not found/);
  });
});
