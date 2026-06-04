import { Client } from "discord.js";
import * as fs from "fs";
import * as path from "path";
import { logger } from "../services/logger";

interface EventModule {
  name: string;
  once: boolean;
  execute: (...args: unknown[]) => unknown;
}

export async function loadEvents(client: Client): Promise<void> {
  const eventsPath = path.join(__dirname, "..", "events");
  const files = fs
    .readdirSync(eventsPath)
    .filter((f) => (f.endsWith(".ts") || f.endsWith(".js")) && !f.endsWith(".d.ts"));

  let loaded = 0;

  for (const file of files) {
    try {
      const filePath = path.join(eventsPath, file);
      const event: EventModule = await import(filePath);

      if (event.name && event.execute) {
        if (event.once) {
          client.once(event.name, (...args: unknown[]) => event.execute(...args));
        } else {
          client.on(event.name, (...args: unknown[]) => event.execute(...args));
        }
        loaded++;
        logger.debug(`Loaded event: ${event.name}`);
      } else {
        logger.warn(`Invalid event file: ${file}`);
      }
    } catch (error) {
      logger.error(`Failed to load event ${file}: ${error}`);
    }
  }

  logger.info(`Loaded ${loaded} events`);
}
