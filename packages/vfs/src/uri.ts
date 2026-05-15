import type { Uri } from "./types.js";

export interface ParsedUri {
  scheme: string;
  path: string;
}

export function parseUri(uri: Uri): ParsedUri {
  const idx = uri.indexOf(":");
  if (idx < 0) throw new Error(`Not a URI: ${uri}`);
  const scheme = uri.slice(0, idx);
  let rest = uri.slice(idx + 1);
  if (rest.startsWith("//")) rest = rest.slice(2);
  if (!rest.startsWith("/")) rest = "/" + rest;
  return { scheme, path: normalize(rest) };
}

export function buildUri(scheme: string, path: string): Uri {
  return `${scheme}://${normalize(path)}`;
}

export function joinUri(uri: Uri, segment: string): Uri {
  if (segment === ".") return uri;
  if (segment === "..") return parentUri(uri);
  const { scheme, path } = parseUri(uri);
  const joined = path.endsWith("/") ? path + segment : path + "/" + segment;
  return buildUri(scheme, joined);
}

export function parentUri(uri: Uri): Uri {
  const { scheme, path } = parseUri(uri);
  if (path === "/" || path === "") return buildUri(scheme, "/");
  const trimmed = path.replace(/\/+$/, "");
  const idx = trimmed.lastIndexOf("/");
  const parent = idx <= 0 ? "/" : trimmed.slice(0, idx);
  return buildUri(scheme, parent);
}

export function uriName(uri: Uri): string {
  const { path } = parseUri(uri);
  if (path === "/" || path === "") return "/";
  const trimmed = path.replace(/\/+$/, "");
  const idx = trimmed.lastIndexOf("/");
  return idx < 0 ? trimmed : trimmed.slice(idx + 1);
}

function normalize(path: string): string {
  const collapsed = path.replace(/\/{2,}/g, "/");
  if (collapsed === "") return "/";
  return collapsed;
}
