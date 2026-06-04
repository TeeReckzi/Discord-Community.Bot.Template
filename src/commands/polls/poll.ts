import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  TextChannel,
} from "discord.js";
import prisma from "../../services/prisma";
import { safeDeferReply, safeEditReply } from "../../services/interactions";
import { brandedEmbed, successEmbed, errorEmbed } from "../../services/embeds";
import { parseDuration, formatRemaining } from "../../utils/duration";

export const data = new SlashCommandBuilder()
  .setName("poll")
  .setDescription("Create polls")
  .addSubcommand((sub) =>
    sub
      .setName("create")
      .setDescription("Create a poll")
      .addStringOption((opt) =>
        opt.setName("question").setDescription("Poll question").setRequired(true),
      )
      .addStringOption((opt) =>
        opt
          .setName("options")
          .setDescription('Options separated by commas (e.g. "Yes,No,Maybe")')
          .setRequired(true),
      )
      .addStringOption((opt) =>
        opt
          .setName("duration")
          .setDescription("Duration (e.g. 30m, 1h, 1d)")
          .setRequired(false),
      ),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await safeDeferReply(interaction, true);

  const guildId = interaction.guildId;
  if (!guildId) {
    await safeEditReply(interaction, { embeds: [errorEmbed("This command can only be used in a server.")] });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "create") {
    await handleCreate(interaction, guildId);
  }
}

async function handleCreate(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
  const question = interaction.options.getString("question", true);
  const optionsRaw = interaction.options.getString("options", true);
  const durationStr = interaction.options.getString("duration");

  const options = optionsRaw.split(",").map((o) => o.trim()).filter((o) => o.length > 0);

  if (options.length < 2) {
    await safeEditReply(interaction, { embeds: [errorEmbed("You must provide at least 2 options.")] });
    return;
  }

  if (options.length > 10) {
    await safeEditReply(interaction, { embeds: [errorEmbed("You can provide at most 10 options.")] });
    return;
  }

  let endsAt: Date | undefined;
  if (durationStr) {
    const ms = parseDuration(durationStr);
    if (ms === null) {
      await safeEditReply(interaction, { embeds: [errorEmbed("Invalid duration format. Use e.g. `30m`, `1h`, `1d`.")] });
      return;
    }
    endsAt = new Date(Date.now() + ms);
  }

  const poll = await prisma.poll.create({
    data: {
      guildId,
      channelId: interaction.channelId,
      question,
      options: options.join(","),
      endsAt: endsAt ?? null,
    },
  });

  const embed = await brandedEmbed(guildId);
  embed.setTitle("📊 Poll");
  embed.setDescription(`**${question}**`);

  const optionList = options.map((opt, i) => `${i + 1}. ${opt}`).join("\n");
  embed.addFields({ name: "Options", value: optionList });

  if (endsAt) {
    embed.setFooter({ text: `Ends in ${formatRemaining(endsAt)}` });
  }

  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  let currentRow = new ActionRowBuilder<ButtonBuilder>();
  let buttonCount = 0;

  for (let i = 0; i < options.length; i++) {
    if (buttonCount === 5) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder<ButtonBuilder>();
      buttonCount = 0;
    }

    currentRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`poll_vote_${poll.id}_${i}`)
        .setLabel(options[i])
        .setStyle(ButtonStyle.Primary),
    );
    buttonCount++;
  }

  if (buttonCount > 0) {
    rows.push(currentRow);
  }

  const channel = interaction.channel as TextChannel;
  const pollMessage = await channel.send({ embeds: [embed], components: rows });

  await prisma.poll.update({
    where: { id: poll.id },
    data: { messageId: pollMessage.id },
  });

  await safeEditReply(interaction, { embeds: [successEmbed("Poll created!")] });
}
