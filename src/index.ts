import * as dotenv from "dotenv";
dotenv.config();

import client from "./client";
import { logger } from "./services/logger";
import { loadCommands } from "./utils/commandLoader";
import { loadEvents } from "./utils/eventLoader";

async function main(): Promise<void> {
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    logger.error("DISCORD_TOKEN is not set in .env");
    process.exit(1);
  }

  logger.info("Starting Aethoria's Keep Bot...");

  await loadCommands(client);
  await loadEvents(client);

  client.login(token);
}

main().catch((error) => {
  logger.error(`Fatal startup error: ${error}`);
  process.exit(1);
});
