import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  TextChannel,
} from "discord.js";
import prisma from "../../services/prisma";
import { requireStaff } from "../../services/permissions";
import { safeDeferReply, safeReply } from "../../services/interactions";
import { successEmbed, errorEmbed } from "../../services/embeds";

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await safeDeferReply(interaction, true);

  if (!(await requireStaff(interaction))) return;

  const isWelcome = interaction.commandName === "welcome";
  const sub = interaction.options.getSubcommand();

  if (sub === "setup") {
    const channel = interaction.options.getChannel("channel", true) as TextChannel;
    const message = interaction.options.getString("message");
    const embed = interaction.options.getBoolean("embed");
    const embedTitle = interaction.options.getString("embed-title");

    const defaultMsg = isWelcome
      ? "Welcome {user} to {server}!"
      : "{user} has left {server}!";

    await prisma.welcomeLeaveConfig.upsert({
      where: { guildId: interaction.guildId! },
      update: {
        type: isWelcome ? "welcome" : "leave",
        channelId: channel.id,
        message: message ?? defaultMsg,
        embedEnabled: embed ?? false,
        embedTitle: embedTitle ?? null,
      },
      create: {
        guildId: interaction.guildId!,
        type: isWelcome ? "welcome" : "leave",
        channelId: channel.id,
        message: message ?? defaultMsg,
        embedEnabled: embed ?? false,
        embedTitle: embedTitle ?? null,
      },
    });

    const label = isWelcome ? "Welcome" : "Leave";
    const reply = successEmbed(`${label} messages configured in ${channel}.`);
    await safeReply(interaction, { embeds: [reply] });
  }
}

const commandData = new SlashCommandBuilder()
  .setName("welcome")
  .setDescription("Configure welcome messages")
  .addSubcommand((sub) =>
    sub
      .setName("setup")
      .setDescription("Set up welcome messages")
      .addChannelOption((opt) =>
        opt.setName("channel").setDescription("Welcome channel").setRequired(true),
      )
      .addStringOption((opt) =>
        opt
          .setName("message")
          .setDescription("Welcome message (use {user}, {server}, {memberCount})")
          .setRequired(false),
      )
      .addBooleanOption((opt) =>
        opt.setName("embed").setDescription("Use embed mode?").setRequired(false),
      )
      .addStringOption((opt) =>
        opt.setName("embed-title").setDescription("Title for the embed").setRequired(false),
      ),
  );

const welcomeCommand = { data: commandData, execute };

export default welcomeCommand;

export const leaveCommand = {
  data: new SlashCommandBuilder()
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
          opt.setName("embed").setDescription("Use embed mode?").setRequired(false),
        )
        .addStringOption((opt) =>
          opt.setName("embed-title").setDescription("Title for the embed").setRequired(false),
        ),
    ),
  execute,
};
