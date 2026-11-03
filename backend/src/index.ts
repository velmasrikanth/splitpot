import { PrismaClient } from "@prisma/client";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const prisma = new PrismaClient();
const app = await createApp(config, {
  readiness: { query: () => prisma.$queryRaw`SELECT 1` },
  prisma,
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  app.log.info({ signal }, "shutting down");
  try {
    await app.close();
    await prisma.$disconnect();
  } catch (err) {
    app.log.error({ err }, "error during shutdown");
    process.exit(1);
  }
  process.exit(0);
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

await app.listen({ host: config.HOST, port: config.PORT });
