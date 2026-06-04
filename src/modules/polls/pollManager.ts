import { ButtonInteraction, TextChannel, Client } from "discord.js";
import prisma from "../../services/prisma";
import { safeDeferUpdate, safeFollowUp } from "../../services/interactions";
import { brandedEmbed } from "../../services/embeds";
import { logger } from "../../services/logger";

export async function handlePollVote(
  interaction: ButtonInteraction,
  pollId: string,
  optionIndex: number,
): Promise<void> {
  await safeDeferUpdate(interaction);

  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: { votes: true },
  });

  if (!poll) {
    await safeFollowUp(interaction, { content: "This poll no longer exists.", ephemeral: true });
    return;
  }

  if (poll.ended) {
    await safeFollowUp(interaction, { content: "This poll has ended.", ephemeral: true });
    return;
  }

  const options = poll.options.split(",");
  if (optionIndex < 0 || optionIndex >= options.length) {
    await safeFollowUp(interaction, { content: "Invalid option.", ephemeral: true });
    return;
  }

  await prisma.pollVote.upsert({
    where: {
      pollId_userId: {
        pollId,
        userId: interaction.user.id,
      },
    },
    create: {
      pollId,
      userId: interaction.user.id,
      option: optionIndex,
    },
    update: {
      option: optionIndex,
    },
  });

  await safeFollowUp(interaction, {
    content: `Your vote has been recorded for: **${options[optionIndex]}**`,
    ephemeral: true,
  });
}

export async function endPoll(pollId: string, client?: Client): Promise<void> {
  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: { votes: true },
  });

  if (!poll || !poll.messageId) return;

  const options = poll.options.split(",");
  const voteCounts = new Array(options.length).fill(0);
  for (const vote of poll.votes) {
    voteCounts[vote.option]++;
  }

  const totalVotes = poll.votes.length;
  const results = options
    .map((opt, i) => {
      const count = voteCounts[i];
      const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
      return `${i + 1}. ${opt} — ${count} vote${count !== 1 ? "s" : ""} (${percentage}%)`;
    })
    .join("\n");

  // Mark ended FIRST so a crash before the message edit doesn't cause a
  // duplicate "ended" notification on the next tick. The Discord edit is
  // idempotent (re-running endPoll early would just re-edit the embed).
  await prisma.poll.update({
    where: { id: pollId },
    data: { ended: true, processingStartedAt: null },
  });

  // Edit the message via API fetch (not cache) so cold-start recovery
  // works even before the guild's channels are cached.
  try {
    const c = client ?? (await import("../../client")).default;
    const channel = (await c.channels.fetch(poll.channelId)) as TextChannel | null;
    if (!channel) {
      logger.warn(`Poll ${pollId} channel ${poll.channelId} not found for end-message edit`);
      return;
    }
    const message = await channel.messages.fetch(poll.messageId);

    const embed = await brandedEmbed(poll.guildId);
    embed.setTitle("📊 Poll Ended");
    embed.setDescription(`**${poll.question}**`);
    embed.addFields({ name: "Results", value: results });
    embed.setFooter({ text: `Total votes: ${totalVotes}` });

    await message.edit({ embeds: [embed], components: [] });
  } catch (error) {
    logger.error(`Failed to update poll message ${pollId}: ${error}`);
  }
}

export async function checkEndedPolls(): Promise<void> {
  try {
    const query = `
      UPDATE "Poll"
      SET "processingStartedAt" = NOW()
      WHERE "ended" = false
        AND "endsAt" <= NOW()
        AND "processingStartedAt" IS NULL
      RETURNING id
    `;

    const result: Array<{ id: string }> = await prisma.$queryRawUnsafe(query);

    for (const row of result) {
      try {
        await endPoll(row.id);
        logger.info(`Auto-ended poll ${row.id}`);
      } catch (error) {
        logger.error(`Failed to auto-end poll ${row.id}: ${error}`);
      }
    }
  } catch (error) {
    logger.error(`checkEndedPolls failed: ${error}`);
  }
}
