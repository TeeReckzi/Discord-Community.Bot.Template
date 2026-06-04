import { Client } from "discord.js";
import * as fs from "fs";
import * as path from "path";
import { logger } from "../services/logger";

interface EventConfig {
  name: string;
  once: boolean;
  execute: (...args: unknown[]) => unknown;
}

type ImportResult = EventConfig | { default: EventConfig };

function resolveEvent(mod: ImportResult): EventConfig | null {
  if (mod && typeof mod === "object" && "name" in mod && "execute" in mod) {
    return mod as EventConfig;
  }
  if (mod && typeof mod === "object" && "default" in mod) {
    const def = (mod as { default: unknown }).default;
    if (def && typeof def === "object" && "name" in def && "execute" in def) {
      return def as EventConfig;
    }
  }
  return null;
}

export async function loadEvents(client: Client): Promise<number> {
  const eventsPath = path.join(__dirname, "..", "events");
  const files = fs
    .readdirSync(eventsPath)
    .filter((f) => (f.endsWith(".ts") || f.endsWith(".js")) && !f.endsWith(".d.ts"));

  let loaded = 0;

  for (const file of files) {
    try {
      const filePath = path.join(eventsPath, file);
      const imported = (await import(filePath)) as ImportResult;
      const event = resolveEvent(imported);

      if (!event) {
        logger.warn(`Invalid event file (no name/execute): ${file}`);
        continue;
      }

      const handler = (...args: unknown[]) => event.execute(...args);

      if (event.once) {
        client.once(event.name, handler);
      } else {
        client.on(event.name, handler);
      }
      loaded++;
      logger.info(`Loaded event: ${event.name} (${event.once ? "once" : "on"}) from ${file}`);
    } catch (error) {
      logger.error(`Failed to load event ${file}: ${error}`);
    }
  }

  logger.info(`Loaded ${loaded} event(s) total`);
  return loaded;
}
