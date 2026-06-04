import * as dotenv from "dotenv";
dotenv.config();

import client from "./client";
import { logger } from "./services/logger";
import { stopAll } from "./services/scheduler";
import { loadCommands } from "./utils/commandLoader";
import { loadEvents } from "./utils/eventLoader";
import prisma from "./services/prisma";

async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  stopAll();
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

async function main(): Promise<void> {
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    logger.error("DISCORD_TOKEN is not set in .env");
    process.exit(1);
  }

  logger.info("Starting Aethoria's Keep Bot...");

  await loadCommands(client);
  await loadEvents(client);

  await client.login(token);
}

main().catch((error) => {
  logger.error(`Fatal startup error: ${error}`);
  process.exit(1);
});
