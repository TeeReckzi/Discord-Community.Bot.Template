import {
  ChatInputCommandInteraction,
  GuildMember,
  PermissionResolvable,
} from "discord.js";
import { errorEmbed } from "./embeds";

export function isStaff(member: GuildMember): boolean {
  return member.permissions.has("Administrator") || member.permissions.has("ManageGuild");
}

export async function requireStaff(
  interaction: ChatInputCommandInteraction,
  quiet = false,
): Promise<boolean> {
  if (!interaction.member || !(interaction.member instanceof GuildMember)) {
    return false;
  }

  if (isStaff(interaction.member)) return true;

  const config = await (await import("./prisma")).default
    .guildConfig
    .findUnique({ where: { guildId: interaction.guildId! } });

  if (config?.staffRole && interaction.member.roles.cache.has(config.staffRole)) {
    return true;
  }

  if (!quiet) {
    const reply = errorEmbed("You need the **Administrator**, **Manage Server**, or configured staff role to use this command.");
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ embeds: [reply] });
    } else {
      await interaction.reply({ embeds: [reply], ephemeral: true });
    }
  }
  return false;
}

export function hasPermission(
  member: GuildMember,
  permission: PermissionResolvable,
): boolean {
  return member.permissions.has(permission);
}

export function requirePermission(
  interaction: ChatInputCommandInteraction,
  permission: PermissionResolvable,
): boolean {
  if (!interaction.member || !(interaction.member instanceof GuildMember)) {
    return false;
  }
  return hasPermission(interaction.member, permission);
}
