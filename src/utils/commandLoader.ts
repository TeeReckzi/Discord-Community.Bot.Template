import { Client, Collection, SlashCommandBuilder } from "discord.js";
import * as fs from "fs";
import * as path from "path";
import { logger } from "../services/logger";

interface CommandConfig {
  data: SlashCommandBuilder | { name: string };
  execute: (interaction: any, ...rest: any[]) => any;
}

type ImportResult =
  | CommandConfig
  | { default: CommandConfig }
  | { data: CommandConfig["data"]; execute: CommandConfig["execute"] };

function resolveCommand(mod: ImportResult): CommandConfig | null {
  if (mod && typeof mod === "object") {
    if ("default" in mod) {
      const def = (mod as { default: unknown }).default;
      if (
        def &&
        typeof def === "object" &&
        "data" in def &&
        "execute" in def
      ) {
        return def as CommandConfig;
      }
    }
    if ("data" in mod && "execute" in mod) {
      return mod as CommandConfig;
    }
  }
  return null;
}

export async function loadCommands(client: Client): Promise<number> {
  (client as any).commands = new Collection<string, CommandConfig>();

  const commandDirs = [
    "config",
    "tickets",
    "welcome",
    "announcements",
    "polls",
    "giveaways",
    "roles",
  ];

  let loaded = 0;

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
        const imported = (await import(filePath)) as ImportResult;
        const command = resolveCommand(imported);

        if (!command) {
          logger.warn(`Invalid command file (no data/execute): ${file}`);
          continue;
        }

        const name = command.data?.name;
        if (!name || typeof command.execute !== "function") {
          logger.warn(`Invalid command file (missing name or execute): ${file}`);
          continue;
        }

        (client as any).commands.set(name, command);
        loaded++;
        logger.info(`Loaded command: /${name} from ${dir}/${file}`);
      } catch (error) {
        logger.error(`Failed to load command ${file}: ${error}`);
      }
    }
  }

  logger.info(`Loaded ${loaded} command(s) total`);
  return loaded;
}
