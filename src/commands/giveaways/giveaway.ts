import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ChannelType,
  GuildTextBasedChannel,
  TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import prisma from "../../services/prisma";
import { requireStaff } from "../../services/permissions";
import { safeDeferReply, safeEditReply, safeFollowUp } from "../../services/interactions";
import { brandedEmbed, successEmbed, errorEmbed } from "../../services/embeds";
import { logger } from "../../services/logger";
import { parseDuration, formatRemaining } from "../../utils/duration";
import { endGiveaway, pickWinners } from "../../modules/giveaways/giveawayManager";

export const data = new SlashCommandBuilder()
  .setName("giveaway")
  .setDescription("Manage giveaways")
  .addSubcommand((sub) =>
    sub
      .setName("create")
      .setDescription("Create a giveaway")
      .addStringOption((opt) =>
        opt.setName("prize").setDescription("The prize").setRequired(true),
      )
      .addStringOption((opt) =>
        opt.setName("duration").setDescription("Duration (e.g. 1h, 2d, 7d)").setRequired(true),
      )
      .addIntegerOption((opt) =>
        opt.setName("winners").setDescription("Number of winners").setRequired(false),
      )
      .addChannelOption((opt) =>
        opt
          .setName("channel")
          .setDescription("Channel to host giveaway in")
          .setRequired(false)
          .addChannelTypes(ChannelType.GuildText),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("end")
      .setDescription("End a giveaway early")
      .addStringOption((opt) =>
        opt.setName("message-id").setDescription("Message ID or link of the giveaway").setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("reroll")
      .setDescription("Reroll a giveaway winner")
      .addStringOption((opt) =>
        opt.setName("message-id").setDescription("Message ID or link of the giveaway").setRequired(true),
      ),
  );

function extractMessageId(input: string): string | null {
  const linkMatch = input.match(/discord(?:app)?\.com\/channels\/\d+\/\d+\/(\d+)/);
  if (linkMatch) return linkMatch[1];
  if (/^\d{17,20}$/.test(input.trim())) return input.trim();
  return null;
}

async function findGiveawayByMessage(input: string, guildId: string) {
  const messageId = extractMessageId(input);
  if (!messageId) return null;

  if (messageId.length >= 17) {
    return prisma.giveaway.findFirst({
      where: { messageId, guildId },
      include: { entries: true },
    });
  }

  return prisma.giveaway.findFirst({
    where: { id: messageId, guildId },
    include: { entries: true },
  });
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await safeDeferReply(interaction);

  const guildId = interaction.guildId;
  if (!guildId) {
    await safeEditReply(interaction, { embeds: [errorEmbed("This command can only be used in a server.")] });
    return;
  }

  const isStaff = await requireStaff(interaction);
  if (!isStaff) return;

  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case "create":
      await handleCreate(interaction, guildId);
      break;
    case "end":
      await handleEnd(interaction, guildId);
      break;
    case "reroll":
      await handleReroll(interaction, guildId);
      break;
  }
}

async function handleCreate(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
  const prize = interaction.options.getString("prize", true);
  const durationStr = interaction.options.getString("duration", true);
  const winnerCount = interaction.options.getInteger("winners") ?? 1;
  const channel = (interaction.options.getChannel("channel") ?? interaction.channel) as GuildTextBasedChannel;

  const durationMs = parseDuration(durationStr);
  if (!durationMs) {
    await safeEditReply(interaction, {
      embeds: [errorEmbed("Invalid duration format. Use e.g. `1h`, `30m`, `2d`, `7d`.")],
    });
    return;
  }

  const endsAt = new Date(Date.now() + durationMs);

  const giveaway = await prisma.giveaway.create({
    data: {
      guildId,
      channelId: channel.id,
      prize,
      winnerCount,
      duration: durationStr,
      endsAt,
      hostedBy: interaction.user.id,
    },
  });

  const embed = await brandedEmbed(guildId);
  embed.setTitle("🎉 Giveaway! 🎉");
  embed.setDescription(`**${prize}**`);
  embed.addFields(
    { name: "Hosted by", value: `<@${interaction.user.id}>`, inline: true },
    { name: "Winners", value: winnerCount.toString(), inline: true },
    { name: "Ends", value: formatRemaining(endsAt), inline: true },
    { name: "Duration", value: durationStr, inline: true },
  );

  const enterRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`giveaway_enter_${giveaway.id}`)
      .setLabel("Enter Giveaway")
      .setStyle(ButtonStyle.Primary),
  );

  const message = await (channel as TextChannel).send({ embeds: [embed], components: [enterRow] });

  await prisma.giveaway.update({
    where: { id: giveaway.id },
    data: { messageId: message.id },
  });

  await safeEditReply(interaction, {
    embeds: [successEmbed(`Giveaway for **${prize}** created in ${channel}!`)],
  });
}

async function handleEnd(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
  const input = interaction.options.getString("message-id", true);
  const giveaway = await findGiveawayByMessage(input, guildId);

  if (!giveaway) {
    await safeEditReply(interaction, { embeds: [errorEmbed("Giveaway not found. Check the message ID or link.")] });
    return;
  }

  if (giveaway.ended) {
    await safeEditReply(interaction, { embeds: [errorEmbed("This giveaway has already ended.")] });
    return;
  }

  const winners = await endGiveaway(interaction.client, giveaway.id);

  if (winners.length > 0) {
    await safeEditReply(interaction, {
      embeds: [successEmbed(`Giveaway **${giveaway.prize}** ended! Winners: ${winners.map((id) => `<@${id}>`).join(", ")}`)],
    });

    const announceEmbed = successEmbed(`Congratulations ${winners.map((id) => `<@${id}>`).join(", ")}! You won **${giveaway.prize}**!`);
    await safeFollowUp(interaction, { embeds: [announceEmbed] });
  } else {
    await safeEditReply(interaction, {
      embeds: [successEmbed(`Giveaway **${giveaway.prize}** ended! No one entered.`)],
    });
  }
}

async function handleReroll(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
  const input = interaction.options.getString("message-id", true);
  const giveaway = await findGiveawayByMessage(input, guildId);

  if (!giveaway) {
    await safeEditReply(interaction, { embeds: [errorEmbed("Giveaway not found. Check the message ID or link.")] });
    return;
  }

  if (!giveaway.ended) {
    await safeEditReply(interaction, { embeds: [errorEmbed("This giveaway is still running. End it first before rerolling.")] });
    return;
  }

  const previousWinners = giveaway.winnerIds ? giveaway.winnerIds.split(",").filter(Boolean) : [];

  const newWinners = await pickWinners(giveaway.id, previousWinners);

  if (newWinners.length === 0) {
    await safeEditReply(interaction, { embeds: [errorEmbed("No eligible entries to reroll.")] });
    return;
  }

  await prisma.giveaway.update({
    where: { id: giveaway.id },
    data: { winnerIds: [...new Set([...previousWinners, ...newWinners])].join(",") },
  });

  const embed = successEmbed(`New winners for **${giveaway.prize}**: ${newWinners.map((id) => `<@${id}>`).join(", ")}`);
  await safeEditReply(interaction, { embeds: [embed] });
}
