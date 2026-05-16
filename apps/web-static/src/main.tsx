import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppRegistry } from "react-native";
import { HostCapabilities } from "@bc/core";
import { createHost, registerStatic } from "@bc/plugin-host";
import { WebSurfaceManager } from "@bc/surfaces-web";
import * as fsMockModule from "@bc/fs-mock";
import fsMockPkg from "@bc/fs-mock/package.json" with { type: "json" };
import { App } from "./App.js";

async function boot(): Promise<void> {
  const surfaces = new WebSurfaceManager();
  const host = createHost({
    capabilities: new HostCapabilities([]),
    surfaces,
  });
  const result = await registerStatic(host, {
    packageJson: fsMockPkg as { name?: string; bc?: unknown },
    module: fsMockModule,
  });
  if (result.status === "disabled") {
    console.warn(`Plugin ${result.name} disabled: ${result.reason ?? ""}`);
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
