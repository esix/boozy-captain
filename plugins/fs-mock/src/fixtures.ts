import type { MockDir, MockNode } from "./fixtures-types.js";
import { generateFileDir, generateNumberedSeries } from "./generator.js";

export type { MockDir, MockFile, MockNode } from "./fixtures-types.js";

const t = (year: number, month: number, day: number): number =>
  new Date(Date.UTC(year, month - 1, day)).getTime();

/**
 * A built-from-pieces fixture tree.
 *
 * Goals:
 *  - Show enough variety that the panel exercises typical TC scenarios:
 *    many similarly-named files (numbered series), wide name+ext spreads,
 *    deep nesting, hidden files, directories at every level.
 *  - Be deterministic — same shape every reload, same in tests.
 *  - Include hand-written entries with `content` so the future lister has
 *    real bytes to show.
 */
export const TREE: MockDir = {
  kind: "dir",
  children: {
    "readme.txt": {
      kind: "file",
      size: 86,
      mtime: t(2026, 5, 15),
      content: "Welcome to fs-mock. A hardcoded tree for the walking skeleton.\n",
    },
    "license.txt": {
      kind: "file",
      size: 1057,
      mtime: t(2025, 1, 1),
      content: "0BSD\n",
    },
    "todo.md": {
      kind: "file",
      size: 200,
      mtime: t(2026, 5, 1),
      content: "- panels\n- listers\n- archives\n",
    },
    ".env": {
      kind: "file",
      size: 64,
      mtime: t(2026, 3, 10),
      hidden: true,
      content: "DEBUG=1\n",
    },
    home: {
      kind: "dir",
      children: {
        user: {
          kind: "dir",
          children: {
            "todo.md": {
              kind: "file",
              size: 512,
              mtime: t(2026, 5, 10),
              content: "- file manager\n- coffee\n- ship\n",
            },
            "address book.csv": {
              kind: "file",
              size: 1834,
              mtime: t(2024, 11, 12),
            },
            docs: generateFileDir(101, 32),
            photos: generateNumberedSeries(202, "Photo", 218, "jpg", 800_000, 6_000_000),
            screenshots: generateNumberedSeries(203, "Screenshot_2025", 84, "png", 90_000, 600_000),
            music: generateFileDir(303, 96, { hiddenChance: 0.02 }),
            videos: generateNumberedSeries(404, "movie", 24, "mkv", 200_000_000, 4_000_000_000),
            downloads: generateFileDir(505, 140, { hiddenChance: 0.08 }),
            projects: {
              kind: "dir",
              children: makeProjects(606, 22),
            },
            ".ssh": {
              kind: "dir",
              children: {
                config: { kind: "file", size: 320, mtime: t(2025, 6, 4), hidden: true },
                "id_rsa": { kind: "file", size: 1675, mtime: t(2025, 6, 4), hidden: true },
                "id_rsa.pub": { kind: "file", size: 380, mtime: t(2025, 6, 4), hidden: true },
                "known_hosts": { kind: "file", size: 4200, mtime: t(2026, 4, 28), hidden: true },
              },
            },
          },
        },
      },
    },
    etc: {
      kind: "dir",
      children: {
        ...generateFileDir(701, 28).children,
        hosts: { kind: "file", size: 128, mtime: t(2024, 1, 1), content: "127.0.0.1 localhost\n" },
        passwd: { kind: "file", size: 1024, mtime: t(2024, 1, 1) },
      },
    },
    var: {
      kind: "dir",
      children: {
        log: generateFileDir(801, 64),
        cache: generateFileDir(802, 40),
        run: generateFileDir(803, 12),
      },
    },
    tmp: generateFileDir(901, 18, { hiddenChance: 0.2 }),
    "Program Files": {
      kind: "dir",
      children: makeApps(1001, 14),
    },
  },
};

function makeProjects(seed: number, count: number): Record<string, MockNode> {
  const out: Record<string, MockNode> = {};
  const names = [
    "boozy-captain",
    "rn-terminal",
    "demo-app",
    "old-blog",
    "esix.github.io",
    "capone",
    "pseudo-c",
    "fs-mock-bench",
    "lister-image",
    "lister-text",
    "qsp-simulator",
    "ghidra-decompiled",
    "freeciv-port",
    "find-elsa",
    "sven-bomwollen",
    "anna-travel",
    "panda3",
    "steelrat",
    "examples",
    "experiments",
    "scrap",
    "shared",
  ];
  for (let i = 0; i < Math.min(count, names.length); i++) {
    out[names[i]!] = generateFileDir(seed + i, 8 + (i % 5) * 3);
  }
  return out;
}

function makeApps(seed: number, count: number): Record<string, MockNode> {
  const out: Record<string, MockNode> = {};
  const apps = [
    "Total Commander",
    "Notepad++",
    "7-Zip",
    "Git",
    "Visual Studio",
    "VSCode",
    "Windows Defender",
    "Java",
    "Python",
    "Node.js",
    "Docker",
    "Postman",
    "MongoDB",
    "Redis",
  ];
  for (let i = 0; i < Math.min(count, apps.length); i++) {
    out[apps[i]!] = generateFileDir(seed + i, 6 + (i % 4) * 2);
  }
  return out;
}

export function lookup(path: string): MockNode | undefined {
  const parts = splitPath(path);
  let node: MockNode = TREE;
  for (const part of parts) {
    if (node.kind !== "dir") return undefined;
    const child: MockNode | undefined = node.children[part];
    if (!child) return undefined;
    node = child;
  }
  return node;
}

export function splitPath(path: string): string[] {
  return path.split("/").filter((p) => p.length > 0);
}
