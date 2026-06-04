import * as dotenv from "dotenv";
dotenv.config();

import * as http from "http";
import client from "./client";
import { logger } from "./services/logger";
import { stopAll } from "./services/scheduler";
import { loadCommands } from "./utils/commandLoader";
import { loadEvents } from "./utils/eventLoader";
import prisma from "./services/prisma";

let healthServer: http.Server | null = null;

async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  stopAll();
  if (healthServer) {
    await new Promise<void>((resolve) => healthServer!.close(() => resolve()));
  }
  try {
    client.destroy();
  } catch (e) {
    logger.warn(`Error destroying client: ${e}`);
  }
  try {
    await prisma.$disconnect();
  } catch (e) {
    logger.warn(`Error disconnecting Prisma: ${e}`);
  }
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  logger.error(`Unhandled promise rejection: ${reason}`);
});
process.on("uncaughtException", (err) => {
  logger.error(`Uncaught exception: ${err}`);
});

function startHealthServer(): void {
  const port = parseInt(process.env.HEALTH_PORT ?? "8080", 10);
  healthServer = http.createServer((req, res) => {
    if (req.url === "/api/health" || req.url === "/health") {
      const ready = !!client.user && client.isReady();
      res.writeHead(ready ? 200 : 503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: ready ? "ok" : "starting", uptime: process.uptime() }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  healthServer.listen(port, () => {
    logger.info(`Healthcheck server listening on :${port}/api/health`);
  });
}

async function verifyDatabaseSchema(): Promise<void> {
  const requiredTables = ["TicketPanel"];

  const result = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = ANY(${requiredTables})
  `;

  const existingTables = new Set(result.map((r) => r.table_name));
  const missingTables = requiredTables.filter((t) => !existingTables.has(t));

  if (missingTables.length > 0) {
    logger.error(
      `FATAL: Required tables missing from database: ${missingTables.join(", ")}. ` +
        `Run 'npx prisma migrate deploy' to apply pending migrations.`
    );
    process.exit(1);
  }

  logger.info("Database schema verification passed: all required tables exist");
}

async function main(): Promise<void> {
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    logger.error("DISCORD_TOKEN is not set in .env");
    process.exit(1);
  }

  logger.info("Starting Aethoria's Keep Bot...");

  await verifyDatabaseSchema();
  await loadCommands(client);
  await loadEvents(client);

  startHealthServer();

  await client.login(token);
}

main().catch((error) => {
  logger.error(`Fatal startup error: ${error}`);
  process.exit(1);
});
