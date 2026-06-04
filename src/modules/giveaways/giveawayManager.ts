import { Client, ButtonInteraction, TextChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Colors } from "discord.js";
import prisma from "../../services/prisma";
import { safeDeferUpdate, safeFollowUp } from "../../services/interactions";
import { logger } from "../../services/logger";

export async function handleGiveawayEntry(interaction: ButtonInteraction, giveawayId: string): Promise<void> {
  await safeDeferUpdate(interaction);

  const giveaway = await prisma.giveaway.findUnique({ where: { id: giveawayId } });
  if (!giveaway || giveaway.ended) {
    await safeFollowUp(interaction, { content: "This giveaway has ended.", ephemeral: true });
    return;
  }

  try {
    await prisma.giveawayEntry.create({
      data: { giveawayId, userId: interaction.user.id },
    });
    await safeFollowUp(interaction, { content: "You entered the giveaway!", ephemeral: true });
  } catch (error: any) {
    if (error.code === "P2002") {
      await safeFollowUp(interaction, { content: "You're already entered!", ephemeral: true });
    } else {
      logger.error(`Giveaway entry error: ${error}`);
      await safeFollowUp(interaction, { content: "An error occurred while entering.", ephemeral: true });
    }
  }
}

export async function pickWinners(giveawayId: string, excludeIds: string[] = []): Promise<string[]> {
  const entries = await prisma.giveawayEntry.findMany({ where: { giveawayId } });
  const eligible = entries.filter((e) => !excludeIds.includes(e.userId));

  if (eligible.length === 0) return [];

  const giveaway = await prisma.giveaway.findUnique({ where: { id: giveawayId } });
  if (!giveaway) return [];

  const count = Math.min(giveaway.winnerCount, eligible.length);
  const shuffled = [...eligible].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((e) => e.userId);
}

export async function endGiveaway(client: Client, giveawayId: string): Promise<string[]> {
  const giveaway = await prisma.giveaway.findUnique({
    where: { id: giveawayId },
    include: { entries: true },
  });

  if (!giveaway || giveaway.ended) return [];

  const winnerIds = await pickWinners(giveawayId);

  await prisma.giveaway.update({
    where: { id: giveawayId },
    data: { ended: true, winnerIds: winnerIds.join(","), processingStartedAt: null },
  });

  if (giveaway.messageId && giveaway.channelId) {
    try {
      const channel = (await client.channels.fetch(giveaway.channelId)) as TextChannel | null;
      if (channel) {
        const message = await channel.messages.fetch(giveaway.messageId);
        if (message) {
          const embed = EmbedBuilder.from(message.embeds[0] ?? new EmbedBuilder())
            .setColor(Colors.Gold);

          if (winnerIds.length > 0) {
            embed.setTitle("🎉 Giveaway Ended! 🎉");
            embed.setDescription(`**Prize:** ${giveaway.prize}`);
            embed.spliceFields(0, embed.data.fields?.length ?? 0);
            embed.addFields(
              { name: "Hosted by", value: `<@${giveaway.hostedBy}>`, inline: true },
              { name: "Total Entries", value: giveaway.entries.length.toString(), inline: true },
              { name: "Winners", value: winnerIds.map((id) => `<@${id}>`).join(", ") },
            );
          } else {
            embed.setTitle("Giveaway Ended");
            embed.setDescription(`**Prize:** ${giveaway.prize}\nNo one entered this giveaway.`);
            embed.spliceFields(0, embed.data.fields?.length ?? 0);
            embed.addFields(
              { name: "Hosted by", value: `<@${giveaway.hostedBy}>`, inline: true },
            );
          }

          const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`giveaway_enter_${giveawayId}`)
              .setLabel("Giveaway Ended")
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true),
          );

          await message.edit({ embeds: [embed], components: [disabledRow] });
        }
      }
    } catch (error) {
      logger.error(`Failed to update giveaway message ${giveawayId}: ${error}`);
    }
  }

  return winnerIds;
}

export async function checkEndedGiveaways(client: Client): Promise<void> {
  try {
    const query = `
      UPDATE "Giveaway"
      SET "processingStartedAt" = NOW()
      WHERE "ended" = false
        AND "endsAt" <= NOW()
        AND "processingStartedAt" IS NULL
      RETURNING id
    `;

    const result: Array<{ id: string }> = await prisma.$queryRawUnsafe(query);

    for (const row of result) {
      try {
        const winners = await endGiveaway(client, row.id);
        logger.info(`Auto-ended giveaway ${row.id} - winners: ${winners.join(", ") || "none"}`);
      } catch (error) {
        logger.error(`Failed to auto-end giveaway ${row.id}: ${error}`);
      }
    }
  } catch (error) {
    logger.error(`checkEndedGiveaways failed: ${error}`);
  }
}
