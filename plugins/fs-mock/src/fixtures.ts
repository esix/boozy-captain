export type MockNode = MockDir | MockFile;

export interface MockDir {
  kind: "dir";
  children: Record<string, MockNode>;
}

export interface MockFile {
  kind: "file";
  size: number;
  mtime: number;
  content?: string;
}

const t = (year: number, month: number, day: number): number =>
  new Date(Date.UTC(year, month - 1, day)).getTime();

export const TREE: MockDir = {
  kind: "dir",
  children: {
    home: {
      kind: "dir",
      children: {
        user: {
          kind: "dir",
          children: {
            docs: {
              kind: "dir",
              children: {
                "spec.md": { kind: "file", size: 4096, mtime: t(2026, 4, 12), content: "# Spec\n\nTBD" },
                "notes.txt": { kind: "file", size: 217, mtime: t(2026, 4, 30), content: "Some notes." },
              },
            },
            photos: {
              kind: "dir",
              children: {
                "vacation.jpg": { kind: "file", size: 2_457_600, mtime: t(2025, 8, 3) },
                "sunset.png": { kind: "file", size: 1_048_576, mtime: t(2025, 9, 14) },
              },
            },
            "todo.md": { kind: "file", size: 512, mtime: t(2026, 5, 10), content: "- file manager\n" },
          },
        },
      },
    },
    etc: {
      kind: "dir",
      children: {
        "hosts": { kind: "file", size: 128, mtime: t(2024, 1, 1), content: "127.0.0.1 localhost\n" },
        "passwd": { kind: "file", size: 1024, mtime: t(2024, 1, 1) },
      },
    },
    "readme.txt": {
      kind: "file",
      size: 86,
      mtime: t(2026, 5, 15),
      content: "Welcome to fs-mock. This is a hardcoded tree for the walking skeleton.\n",
    },
  },
};

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
