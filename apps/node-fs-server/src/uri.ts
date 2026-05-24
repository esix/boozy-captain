// Tiny URI helpers, kept local so the server has no workspace runtime deps.
// Format: file:///<path>. On Windows, drive letter appears as the first path
// segment, e.g. file:///C:/Users/esix → fs path C:/Users/esix.

export interface ParsedUri {
  scheme: string;
  path: string;
}

export function parseUri(uri: string): ParsedUri {
  const idx = uri.indexOf(":");
  if (idx < 0) throw new Error(`Not a URI: ${uri}`);
  const scheme = uri.slice(0, idx);
  let rest = uri.slice(idx + 1);
  if (rest.startsWith("//")) rest = rest.slice(2);
  if (!rest.startsWith("/")) rest = "/" + rest;
  return { scheme, path: normalize(rest) };
}

export function buildUri(scheme: string, path: string): string {
  return `${scheme}://${normalize(path)}`;
}

function normalize(path: string): string {
  const collapsed = path.replace(/\/{2,}/g, "/");
  return collapsed === "" ? "/" : collapsed;
}
