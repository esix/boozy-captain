import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { fsMiddleware } from "@bc/app-node-fs-server";

const FS_PREFIX = "/_fs";

// Mount the node-fs-server's request handler into Vite's connect stack so the
// FS API is served by the same process and origin as the SPA. Same-origin →
// no CORS dance for the browser plugin. Production builds that don't ship
// Vite need to run `@bc/app-node-fs-server` standalone (see its dev script).
function bcFsPlugin(): Plugin {
  return {
    name: "bc-fs",
    configureServer(server) {
      server.middlewares.use(FS_PREFIX, fsMiddleware());
    },
    // `vite preview` serves the built bundle; expose the API there too so
    // the same baseUrl ("/_fs") keeps working in `yarn preview`.
    configurePreviewServer(server) {
      server.middlewares.use(FS_PREFIX, fsMiddleware());
    },
  };
}

export default defineConfig({
  plugins: [react(), bcFsPlugin()],
  resolve: {
    alias: [
      { find: /^react-native$/, replacement: "react-native-web" },
    ],
    extensions: [".web.tsx", ".web.ts", ".tsx", ".ts", ".jsx", ".js"],
  },
  define: {
    __DEV__: JSON.stringify(true),
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV ?? "development"),
  },
  optimizeDeps: {
    // Don't try to pre-bundle the FS-server package — it imports node:* and
    // is only used by the Vite plugin above, never the browser.
    exclude: ["@bc/app-node-fs-server"],
    esbuildOptions: {
      resolveExtensions: [".web.tsx", ".web.ts", ".tsx", ".ts", ".jsx", ".js"],
      loader: { ".js": "jsx" },
      jsx: "automatic",
    },
  },
  server: {
    port: 5173,
    open: true,
  },
});
