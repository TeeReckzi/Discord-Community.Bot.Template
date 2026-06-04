import { REST, Routes, PermissionFlagsBits } from "discord.js";
import { logger } from "./services/logger";
import prisma from "./services/prisma";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * Sync Discord command permissions to grant the configured staff role
 * access to all admin commands. This works around the limitation that
 * `default_member_permissions` can only reference Discord permissions,
 * not custom database roles.
 *
 * Run with: `npx tsx src/sync-command-permissions.ts`
 */
async function main(): Promise<void> {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID;

  if (!token || !clientId) {
    logger.error("DISCORD_TOKEN and CLIENT_ID must be set in .env");
    process.exit(1);
  }

  const rest = new REST({ version: "10" }).setToken(token);

  const configs = await prisma.guildConfig.findMany({
    where: { staffRole: { not: null } },
  });

  if (configs.length === 0) {
    logger.info("No guilds have a staff role configured. Nothing to sync.");
    return;
  }

  for (const config of configs) {
    if (!config.staffRole) continue;
    try {
      const commands = (await rest.get(
        Routes.applicationGuildCommands(clientId, config.guildId),
      )) as Array<{ id: string; name: string }>;

      const permissions = commands.map((cmd) => ({
        id: cmd.id,
        permissions: [
          {
            id: config.staffRole!,
            type: 1, // ROLE
            permission: true,
          },
        ],
      }));

      await rest.put(
        `/applications/${clientId}/guilds/${config.guildId}/commands/permissions`,
        { body: permissions },
      );

      logger.info(
        `Synced ${commands.length} command permissions for guild ${config.guildId} (staff role: ${config.staffRole})`,
      );
    } catch (error) {
      logger.error(`Failed to sync permissions for guild ${config.guildId}: ${error}`);
    }
  }
}

main().catch((error) => {
  logger.error(`Fatal error: ${error}`);
  process.exit(1);
});
