import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { startCleanupJob } from "./jobs/cleanup.js";

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`[server] listening on http://localhost:${env.port} (${env.nodeEnv})`);
  startCleanupJob();
});

function shutdown(signal: string) {
  console.log(`[server] received ${signal}, shutting down...`);
  server.close(() => process.exit(0));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
