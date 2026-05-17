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
  hidden?: boolean;
  exec?: boolean;
}
