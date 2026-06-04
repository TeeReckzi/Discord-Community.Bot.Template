import { Client } from "discord.js";
import prisma from "./prisma";
import { logger } from "./logger";

export async function recoverState(client: Client): Promise<void> {
  logger.info("Running state recovery...");

  await recoverGiveaways(client);
  await recoverPolls(client);
  await recoverAnnouncements(client);

  logger.info("State recovery complete");
}

async function recoverGiveaways(client: Client): Promise<void> {
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

    if (result.length === 0) return;

    logger.info(`Recovering ${result.length} expired giveaway(s)`);

    const { endGiveaway } = await import("../modules/giveaways/giveawayManager");
    for (const row of result) {
      try {
        await endGiveaway(client, row.id);
        logger.info(`Recovered giveaway ${row.id}`);
      } catch (error) {
        logger.error(`Failed to recover giveaway ${row.id}: ${error}`);
      }
    }
  } catch (error) {
    logger.error(`Giveaway recovery failed: ${error}`);
  }
}

async function recoverPolls(client: Client): Promise<void> {
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

    if (result.length === 0) return;

    logger.info(`Recovering ${result.length} expired poll(s)`);

    const { endPoll } = await import("../modules/polls/pollManager");
    for (const row of result) {
      try {
        await endPoll(row.id);
        logger.info(`Recovered poll ${row.id}`);
      } catch (error) {
        logger.error(`Failed to recover poll ${row.id}: ${error}`);
      }
    }
  } catch (error) {
    logger.error(`Poll recovery failed: ${error}`);
  }
}

async function recoverAnnouncements(client: Client): Promise<void> {
  try {
    const { processScheduledAnnouncements } = await import(
      "../modules/announcements/announcementManager"
    );

    const dueCount = await prisma.announcement.count({
      where: {
        scheduledAt: { lte: new Date() },
        published: false,
      },
    });

    if (dueCount > 0) {
      logger.info(`Recovering ${dueCount} scheduled announcement(s)`);
      await processScheduledAnnouncements(client);
    }
  } catch (error) {
    logger.error(`Announcement recovery failed: ${error}`);
  }
}
