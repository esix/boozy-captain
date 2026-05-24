import { startServer } from "./server.js";

const port = Number(process.env.PORT ?? 7777);
const host = process.env.HOST ?? "127.0.0.1";

startServer({ host, port })
  .then(({ url }) => {
    process.stdout.write(`node-fs-server listening on ${url}\n`);
  })
  .catch((err) => {
    process.stderr.write(`startup failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
    process.exit(1);
  });
