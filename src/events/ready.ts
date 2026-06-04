import { Events, Client } from "discord.js";
import { logger } from "../services/logger";
import { startScheduler } from "../services/scheduler";

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client: Client): Promise<void> {
    logger.info(`Logged in as ${client.user?.tag}`);
    logger.info(`Ready in ${client.guilds.cache.size} guild(s)`);

    // startScheduler awaits recoveryState and starts the heartbeat loop.
    // A failure here (e.g. DB down) is non-fatal: log and let the bot stay
    // online so commands/interactions still respond while the loop is paused.
    try {
      await startScheduler(client);
    } catch (error) {
      logger.error(`Scheduler failed to start (bot will stay online, ticks paused): ${error}`);
    }
  },
};
