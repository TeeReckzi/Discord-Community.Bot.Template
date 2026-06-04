import {
  ChatInputCommandInteraction,
  GuildMember,
  PermissionFlagsBits,
} from "discord.js";
import prisma from "./prisma";
import { errorEmbed } from "./embeds";
import { safeDeferReply, safeEditReply, safeReply } from "./interactions";
import { logger } from "./logger";

export type DenyReason =
  | "not_in_guild"
  | "not_member"
  | "missing_permission"
  | "no_staff_role";

export interface PermissionContext {
  guildId: string;
  userId: string;
  commandName: string;
}

export function logDeniedAccess(
  ctx: PermissionContext,
  reason: DenyReason,
  details?: string,
): void {
  logger.warn(
    `Access denied: guildId=${ctx.guildId} userId=${ctx.userId} command=${ctx.commandName} reason=${reason}${details ? ` details=${details}` : ""}`,
  );
}

export async function canManageBot(
  interaction: ChatInputCommandInteraction,
): Promise<{ allowed: boolean; reason?: DenyReason }> {
  if (!interaction.guild) {
    return { allowed: false, reason: "not_in_guild" };
  }

  let member: GuildMember | null = null;
  if (interaction.member instanceof GuildMember) {
    member = interaction.member;
  } else {
    try {
      member = await interaction.guild.members.fetch(interaction.user.id);
    } catch {
      return { allowed: false, reason: "not_member" };
    }
  }

  if (interaction.guild.ownerId === member.id) {
    return { allowed: true };
  }

  if (member.permissions.has(PermissionFlagsBits.Administrator)) {
    return { allowed: true };
  }

  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return { allowed: true };
  }

  try {
    const config = await prisma.guildConfig.findUnique({
      where: { guildId: interaction.guild.id },
    });
    if (
      config?.staffRole &&
      member.roles.cache.has(config.staffRole)
    ) {
      return { allowed: true };
    }
  } catch (error) {
    logger.error(`Failed to fetch GuildConfig for permission check: ${error}`);
  }

  return { allowed: false, reason: "no_staff_role" };
}

export interface RequireBotManagerOptions {
  /** Defer reply before doing permission check (default: true). */
  defer?: boolean;
  /** Make all responses ephemeral (default: true). */
  ephemeral?: boolean;
  /** Custom message when access is denied. */
  customMessage?: string;
}

const DEFAULT_DENY_MESSAGE =
  "You don't have permission to use this command. Server admins, the guild owner, users with Manage Server, or members of the configured staff role can use it.";

export async function requireBotManager(
  interaction: ChatInputCommandInteraction,
  options: RequireBotManagerOptions = {},
): Promise<boolean> {
  const { defer = true, ephemeral = true, customMessage } = options;
  const opts = { ephemeral } as const;

  if (!interaction.guild) {
    logDeniedAccess(
      {
        guildId: "dm",
        userId: interaction.user.id,
        commandName: interaction.commandName,
      },
      "not_in_guild",
    );
    if (!interaction.replied && !interaction.deferred) {
      await safeReply(interaction, {
        embeds: [
          errorEmbed("This command can only be used in a server."),
        ],
        ...opts,
      });
    }
    return false;
  }

  if (defer && !interaction.deferred && !interaction.replied) {
    await safeDeferReply(interaction, ephemeral);
  }

  const ctx: PermissionContext = {
    guildId: interaction.guild.id,
    userId: interaction.user.id,
    commandName: interaction.commandName,
  };

  const result = await canManageBot(interaction);
  if (result.allowed) return true;

  logDeniedAccess(ctx, result.reason ?? "missing_permission");

  const message = customMessage ?? DEFAULT_DENY_MESSAGE;
  const payload = { embeds: [errorEmbed(message)], ...opts };

  try {
    if (interaction.deferred) {
      await safeEditReply(interaction, payload);
    } else if (interaction.replied) {
      await interaction.followUp(payload);
    } else {
      await safeReply(interaction, payload);
    }
  } catch (error) {
    logger.error(`Failed to send permission denied reply: ${error}`);
  }

  return false;
}

export async function isStaff(member: GuildMember): Promise<boolean> {
  return (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.permissions.has(PermissionFlagsBits.ManageGuild)
  );
}

export async function requireStaff(
  interaction: ChatInputCommandInteraction,
  quiet = false,
): Promise<boolean> {
  const result = await canManageBot(interaction);
  if (result.allowed) return true;

  if (quiet) return false;

  logDeniedAccess(
    {
      guildId: interaction.guildId ?? "unknown",
      userId: interaction.user.id,
      commandName: interaction.commandName,
    },
    result.reason ?? "missing_permission",
  );

  return false;
}

export function hasPermission(
  member: GuildMember,
  permission: keyof typeof PermissionFlagsBits | bigint,
): boolean {
  if (typeof permission === "bigint") {
    return member.permissions.has(permission);
  }
  return member.permissions.has(PermissionFlagsBits[permission]);
}
