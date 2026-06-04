import { Events, Client } from "discord.js";
import { logger } from "../services/logger";
import { startScheduler } from "../services/scheduler";

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client: Client): Promise<void> {
    logger.info(`Logged in as ${client.user?.tag}`);
    logger.info(`Ready in ${client.guilds.cache.size} guild(s)`);

    await startScheduler(client);
  },
};
