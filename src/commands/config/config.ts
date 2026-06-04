import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ChannelType,
  GuildTextBasedChannel,
} from "discord.js";
import prisma from "../../services/prisma";
import { requireBotManager } from "../../services/permissions";
import { safeDeferReply, safeEditReply } from "../../services/interactions";
import { brandedEmbed, successEmbed, errorEmbed } from "../../services/embeds";

const HEX_COLOR_REGEX = /^#([0-9A-Fa-f]{6})$/;

function isValidHexColor(color: string): boolean {
  return HEX_COLOR_REGEX.test(color);
}

export const data = new SlashCommandBuilder()
  .setName("config")
  .setDescription("View or modify server configuration")
  .addSubcommand((sub) =>
    sub.setName("view").setDescription("View current server configuration"),
  )
  .addSubcommand((sub) =>
    sub
      .setName("set-log-channel")
      .setDescription("Set the logging channel")
      .addChannelOption((opt) =>
        opt
          .setName("channel")
          .setDescription("The channel to log to")
          .setRequired(true)
          .addChannelTypes(ChannelType.GuildText),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("set-brand-color")
      .setDescription("Set the brand color for embeds (hex)")
      .addStringOption((opt) =>
        opt
          .setName("color")
          .setDescription("Hex color code (e.g. #5865F2)")
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("set-staff-role")
      .setDescription("Set the staff role")
      .addRoleOption((opt) =>
        opt.setName("role").setDescription("The staff role").setRequired(true),
      ),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId;

  if (interaction.options.getSubcommand() === "view") {
    if (!guildId) {
      await safeDeferReply(interaction, true);
      await safeEditReply(interaction, {
        embeds: [errorEmbed("This command can only be used in a server.")],
        ephemeral: true,
      });
      return;
    }
    if (!(await requireBotManager(interaction))) return;
    await handleView(interaction, guildId);
    return;
  }

  if (!(await requireBotManager(interaction))) return;
  if (!guildId) return;

  switch (interaction.options.getSubcommand()) {
    case "set-log-channel":
      await handleSetLogChannel(interaction, guildId);
      break;
    case "set-brand-color":
      await handleSetBrandColor(interaction, guildId);
      break;
    case "set-staff-role":
      await handleSetStaffRole(interaction, guildId);
      break;
  }
}

async function handleView(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
  const config = await prisma.guildConfig.upsert({
    where: { guildId },
    update: {},
    create: { guildId },
  });

  const embed = await brandedEmbed(guildId);
  embed.setTitle("Server Configuration");

  const logChannel = config.logChannel
    ? `<#${config.logChannel}>`
    : "Not set";

  embed.addFields(
    { name: "Log Channel", value: logChannel, inline: true },
    { name: "Brand Color", value: config.brandColor ?? "#5865F2", inline: true },
    { name: "Staff Role", value: config.staffRole ? `<@&${config.staffRole}>` : "Not set", inline: true },
  );

  await safeEditReply(interaction, { embeds: [embed] });
}

async function handleSetLogChannel(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
  const channel = interaction.options.getChannel("channel", true) as GuildTextBasedChannel;

  await prisma.guildConfig.upsert({
    where: { guildId },
    update: { logChannel: channel.id },
    create: { guildId, logChannel: channel.id },
  });

  await safeEditReply(interaction, { embeds: [successEmbed(`Log channel set to ${channel}`)] });
}

async function handleSetBrandColor(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
  const color = interaction.options.getString("color", true);

  if (!isValidHexColor(color)) {
    await safeEditReply(interaction, {
      embeds: [errorEmbed("Invalid hex color format. Use `#RRGGBB` (e.g. `#5865F2`).")],
      ephemeral: true,
    });
    return;
  }

  await prisma.guildConfig.upsert({
    where: { guildId },
    update: { brandColor: color },
    create: { guildId, brandColor: color },
  });

  await safeEditReply(interaction, { embeds: [successEmbed(`Brand color set to ${color}`)] });
}

async function handleSetStaffRole(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
  const role = interaction.options.getRole("role", true);

  await prisma.guildConfig.upsert({
    where: { guildId },
    update: { staffRole: role.id },
    create: { guildId, staffRole: role.id },
  });

  await safeEditReply(interaction, { embeds: [successEmbed(`Staff role set to ${role}`)] });
}
