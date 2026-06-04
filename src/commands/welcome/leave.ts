import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  TextChannel,
} from "discord.js";
import prisma from "../../services/prisma";
import { requireBotManager } from "../../services/permissions";
import { successEmbed } from "../../services/embeds";

export const data = new SlashCommandBuilder()
  .setName("leave")
  .setDescription("Configure leave messages")
  .addSubcommand((sub) =>
    sub
      .setName("setup")
      .setDescription("Set up leave messages")
      .addChannelOption((opt) =>
        opt.setName("channel").setDescription("Leave channel").setRequired(true),
      )
      .addStringOption((opt) =>
        opt
          .setName("message")
          .setDescription("Leave message (use {user}, {server}, {memberCount})")
          .setRequired(false),
      )
      .addBooleanOption((opt) =>
        opt
          .setName("embed")
          .setDescription("Use embed mode?")
          .setRequired(false),
      )
      .addStringOption((opt) =>
        opt
          .setName("embed-title")
          .setDescription("Title for the embed")
          .setRequired(false),
      ),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!(await requireBotManager(interaction))) return;

  const sub = interaction.options.getSubcommand();
  if (sub !== "setup") return;

  const channel = interaction.options.getChannel("channel", true) as TextChannel;
  const message = interaction.options.getString("message");
  const embed = interaction.options.getBoolean("embed");
  const embedTitle = interaction.options.getString("embed-title");

  const defaultMsg = "{user} has left {server}!";

  await prisma.welcomeLeaveConfig.upsert({
    where: { guildId_type: { guildId: interaction.guildId!, type: "leave" } },
    update: {
      channelId: channel.id,
      message: message ?? defaultMsg,
      embedEnabled: embed ?? false,
      embedTitle: embedTitle ?? null,
    },
    create: {
      guildId: interaction.guildId!,
      type: "leave",
      channelId: channel.id,
      message: message ?? defaultMsg,
      embedEnabled: embed ?? false,
      embedTitle: embedTitle ?? null,
    },
  });

  await interaction.editReply({
    embeds: [successEmbed(`Leave messages configured in ${channel}.`)],
  });
}
