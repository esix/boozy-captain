/**
 * Deterministic fixture generator for fs-mock. Same seed → same tree, so the
 * panel rendering is reproducible across reloads (and tests).
 *
 * We combine adjectives, nouns, and a few naming conventions (camelCase,
 * snake_case, UPPER, numbered series) so the panel sees varied lengths,
 * extensions, and visual character.
 */
import type { MockDir, MockFile } from "./fixtures-types.js";

const ADJECTIVES = [
  "old",
  "new",
  "final",
  "draft",
  "urgent",
  "archived",
  "beta",
  "alpha",
  "test",
  "backup",
  "broken",
  "fixed",
  "clean",
  "shared",
  "private",
  "public",
  "temp",
  "big",
  "small",
  "main",
  "legacy",
  "modern",
  "current",
  "historic",
  "sample",
  "demo",
  "example",
  "reference",
  "pinned",
  "scratch",
  "official",
  "internal",
  "external",
  "weekly",
  "monthly",
  "annual",
];

const NOUNS = [
  "report",
  "document",
  "photo",
  "archive",
  "project",
  "data",
  "backup",
  "config",
  "notes",
  "draft",
  "image",
  "video",
  "music",
  "demo",
  "script",
  "readme",
  "install",
  "setup",
  "index",
  "page",
  "screen",
  "snapshot",
  "thumbnail",
  "log",
  "crash",
  "session",
  "cache",
  "chunk",
  "asset",
  "icon",
  "sound",
  "track",
  "movie",
  "episode",
  "preview",
  "build",
  "release",
  "stage",
  "preset",
  "template",
  "layout",
];

const EXTENSIONS = {
  text: ["txt", "md", "log", "conf", "ini", "cfg", "yml", "yaml"],
  image: ["png", "jpg", "jpeg", "bmp", "gif", "webp", "svg", "ico"],
  archive: ["zip", "rar", "tar", "gz", "7z", "tgz"],
  exe: ["exe", "bat", "cmd", "dll", "ps1"],
  doc: ["doc", "docx", "xls", "xlsx", "pdf", "rtf", "odt"],
  data: ["json", "xml", "csv", "tsv", "db"],
  code: ["ts", "tsx", "js", "jsx", "py", "cs", "cpp", "h", "html", "css", "rs", "go"],
  media: ["mp3", "mp4", "mkv", "mov", "wav", "flac", "ogg"],
  misc: ["dat", "tmp", "bak", "old", "out"],
};

type ExtCategory = keyof typeof EXTENSIONS;

interface Rng {
  next(): number;
  pick<T>(arr: readonly T[]): T;
  int(loIncl: number, hiExcl: number): number;
  chance(p: number): boolean;
}

function makeRng(seed: number): Rng {
  let s = seed >>> 0;
  const next = (): number => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
  return {
    next,
    pick<T>(arr: readonly T[]): T {
      if (arr.length === 0) throw new Error("pick from empty");
      return arr[Math.floor(next() * arr.length)]!;
    },
    int(loIncl, hiExcl) {
      return loIncl + Math.floor(next() * (hiExcl - loIncl));
    },
    chance(p: number): boolean {
      return next() < p;
    },
  };
}

const NAMING_STYLES = ["lower-underscore", "lower-dash", "camelCase", "PascalCase", "UPPER", "Title Case"] as const;
type NamingStyle = (typeof NAMING_STYLES)[number];

function applyStyle(parts: string[], style: NamingStyle): string {
  switch (style) {
    case "lower-underscore":
      return parts.map((p) => p.toLowerCase()).join("_");
    case "lower-dash":
      return parts.map((p) => p.toLowerCase()).join("-");
    case "camelCase":
      return parts
        .map((p, i) => (i === 0 ? p.toLowerCase() : p[0]!.toUpperCase() + p.slice(1).toLowerCase()))
        .join("");
    case "PascalCase":
      return parts.map((p) => p[0]!.toUpperCase() + p.slice(1).toLowerCase()).join("");
    case "UPPER":
      return parts.map((p) => p.toUpperCase()).join("_");
    case "Title Case":
      return parts.map((p) => p[0]!.toUpperCase() + p.slice(1).toLowerCase()).join(" ");
  }
}

function pickName(rng: Rng): string {
  const style = rng.pick(NAMING_STYLES);
  const adj = rng.pick(ADJECTIVES);
  const noun = rng.pick(NOUNS);
  // 20% just noun, 60% adj+noun, 20% adj+noun+adj (longer)
  let parts: string[];
  const roll = rng.next();
  if (roll < 0.2) parts = [noun];
  else if (roll < 0.8) parts = [adj, noun];
  else parts = [adj, noun, rng.pick(ADJECTIVES)];
  return applyStyle(parts, style);
}

function pickExtCategory(rng: Rng): ExtCategory {
  const cats: ExtCategory[] = ["text", "image", "archive", "exe", "doc", "data", "code", "media", "misc"];
  return rng.pick(cats);
}

function pickSize(rng: Rng, cat: ExtCategory): number {
  // Heuristic sizes per category
  switch (cat) {
    case "image":
      return rng.int(50_000, 5_000_000);
    case "media":
      return rng.int(1_000_000, 200_000_000);
    case "archive":
      return rng.int(100_000, 50_000_000);
    case "exe":
      return rng.int(20_000, 20_000_000);
    case "doc":
      return rng.int(10_000, 5_000_000);
    case "data":
      return rng.int(100, 1_000_000);
    case "code":
      return rng.int(100, 100_000);
    case "text":
      return rng.int(50, 200_000);
    case "misc":
      return rng.int(0, 1_000_000);
  }
}

function pickMtime(rng: Rng): number {
  // Span: 5 years back from a fixed reference so dates are stable
  const REF = Date.UTC(2026, 4, 16);
  const FIVE_YEARS = 5 * 365 * 24 * 3600 * 1000;
  return REF - rng.int(0, FIVE_YEARS);
}

export function generateFile(rng: Rng, opts?: { hidden?: boolean; namePrefix?: string }): { name: string; node: MockFile } {
  const cat = pickExtCategory(rng);
  const ext = rng.pick(EXTENSIONS[cat]);
  const base = opts?.namePrefix ?? pickName(rng);
  const name = `${base}.${ext}`;
  return {
    name,
    node: {
      kind: "file",
      size: pickSize(rng, cat),
      mtime: pickMtime(rng),
      hidden: opts?.hidden,
    },
  };
}

/** Builds a directory by generating `count` files. */
export function generateFileDir(seed: number, count: number, opts?: { hiddenChance?: number }): MockDir {
  const rng = makeRng(seed);
  const children: Record<string, MockFile | MockDir> = {};
  for (let i = 0; i < count; i++) {
    let entry = generateFile(rng, { hidden: rng.chance(opts?.hiddenChance ?? 0.05) });
    // Avoid name collisions deterministically by appending a suffix
    let suffix = 0;
    while (children[entry.name]) {
      suffix++;
      entry = generateFile(rng, { hidden: rng.chance(opts?.hiddenChance ?? 0.05), namePrefix: `${stripExt(entry.name)}_${suffix}` });
    }
    children[entry.name] = entry.node;
  }
  return { kind: "dir", children };
}

/** A "photo album" — numbered series with the same prefix. */
export function generateNumberedSeries(seed: number, prefix: string, count: number, ext: string, sizeMin: number, sizeMax: number): MockDir {
  const rng = makeRng(seed);
  const children: Record<string, MockFile> = {};
  const digits = String(count).length;
  for (let i = 1; i <= count; i++) {
    const name = `${prefix}_${String(i).padStart(digits, "0")}.${ext}`;
    children[name] = {
      kind: "file",
      size: rng.int(sizeMin, sizeMax),
      mtime: pickMtime(rng),
    };
  }
  return { kind: "dir", children };
}

function stripExt(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? name : name.slice(0, dot);
}
