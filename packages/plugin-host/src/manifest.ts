import { z } from "zod";

const capabilitySchema = z.enum([
  "fs.read",
  "fs.write",
  "fs.watch",
  "fs.symlink",
  "fs.permissions",
  "net.fetch",
  "net.stream",
  "net.ws",
  "process.spawn",
  "process.tty",
  "clipboard.read",
  "clipboard.write",
  "dialog.native",
  "crypto.subtle",
  "storage.persistent",
]);

export const bcManifestSchema = z.object({
  scheme: z.string().optional(),
  capabilities: z.array(capabilitySchema).optional(),
  requires: z.array(capabilitySchema).optional(),
});

export type BcManifest = z.infer<typeof bcManifestSchema>;

export function parseManifest(pkgJson: { bc?: unknown; boozy?: unknown; name?: string }): BcManifest {
  const raw = pkgJson.bc ?? pkgJson.boozy ?? {};
  const result = bcManifestSchema.safeParse(raw);
  if (!result.success) {
    const name = pkgJson.name ?? "<unknown>";
    throw new Error(`Invalid bc manifest in ${name}: ${result.error.message}`);
  }
  return result.data;
}
