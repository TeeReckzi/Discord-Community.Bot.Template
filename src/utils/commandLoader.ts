import { Client, Collection } from "discord.js";
import * as fs from "fs";
import * as path from "path";
import { logger } from "../services/logger";

interface CommandModule {
  data: { name: string };
  execute: (...args: unknown[]) => unknown;
}

export async function loadCommands(client: Client): Promise<void> {
  (client as any).commands = new Collection<string, CommandModule>();

  const commandDirs = [
    "config",
    "tickets",
    "welcome",
    "announcements",
    "polls",
    "giveaways",
    "roles",
  ];

  for (const dir of commandDirs) {
    const dirPath = path.join(__dirname, "..", "commands", dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      continue;
    }

    const files = fs
      .readdirSync(dirPath)
      .filter((f) => (f.endsWith(".ts") || f.endsWith(".js")) && !f.endsWith(".d.ts"));

    for (const file of files) {
      try {
        const filePath = path.join(dirPath, file);
        const command: CommandModule = await import(filePath);

        if (command.data?.name && typeof command.execute === "function") {
          (client as any).commands.set(command.data.name, command);
          logger.debug(`Loaded command: ${command.data.name}`);
        } else {
          logger.warn(`Invalid command file: ${file}`);
        }
      } catch (error) {
        logger.error(`Failed to load command ${file}: ${error}`);
      }
    }
  }

  logger.info(`Loaded ${((client as any).commands as Collection<string, CommandModule>).size} commands`);
}
