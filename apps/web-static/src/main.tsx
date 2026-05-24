import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppRegistry } from "react-native";
import { HostCapabilities } from "@bc/core";
import { createHost, registerStatic } from "@bc/plugin-host";
import { WebSurfaceManager } from "@bc/surfaces-web";
import * as fsMockModule from "@bc/fs-mock";
import fsMockPkg from "@bc/fs-mock/package.json" with { type: "json" };
import * as fsHttpModule from "@bc/fs-http";
import fsHttpPkg from "@bc/fs-http/package.json" with { type: "json" };
import { App } from "./App.js";

// Web host capabilities. `net.fetch` + `net.stream` unlock the HTTP-backed
// `file:` filesystem plugin; without them registerStatic disables it.
const WEB_CAPABILITIES = ["net.fetch", "net.stream"] as const;
// Default is the same-origin sub-path mounted by Vite's bc-fs plugin (see
// apps/web-static/vite.config.ts). Override via env var when the SPA is
// served separately from the FS host (e.g. a built bundle pointing at a
// standalone @bc/app-node-fs-server).
const FS_HTTP_BASE_URL =
  (import.meta as { env?: Record<string, string> }).env?.VITE_FS_HTTP_BASE_URL ?? "/_fs";

async function boot(): Promise<void> {
  const surfaces = new WebSurfaceManager();
  const host = createHost({
    capabilities: new HostCapabilities(WEB_CAPABILITIES),
    surfaces,
  });

  const results = await Promise.all([
    registerStatic(host, {
      packageJson: fsMockPkg as { name?: string; bc?: unknown },
      module: fsMockModule,
    }),
    registerStatic(host, {
      packageJson: fsHttpPkg as { name?: string; bc?: unknown },
      module: {
        activate: (h) => fsHttpModule.activate(h, { baseUrl: FS_HTTP_BASE_URL }),
      },
    }),
  ]);
  for (const r of results) {
    if (r.status === "disabled") {
      console.warn(`Plugin ${r.name} disabled: ${r.reason ?? ""}`);
    }
  }

  AppRegistry.registerComponent("Boozy", () => () => (
    <App vfs={host.vfs} surfaces={surfaces} />
  ));
  const root = document.getElementById("root");
  if (!root) throw new Error("No #root element");
  createRoot(root).render(
    <StrictMode>
      <App vfs={host.vfs} surfaces={surfaces} />
    </StrictMode>,
  );
}

void boot();
