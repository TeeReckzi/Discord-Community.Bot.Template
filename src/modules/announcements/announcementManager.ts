import { Client, TextChannel, EmbedBuilder, Message } from "discord.js";
import prisma from "../../services/prisma";
import { logger } from "../../services/logger";

export interface CreateAnnouncementData {
  guildId: string;
  channelId: string;
  content: string;
  title?: string;
  scheduledAt?: Date;
}

export interface AnnouncementResult {
  announcement: {
    id: string;
    guildId: string;
    channelId: string;
    messageId: string | null;
    content: string;
    embed: string | null;
    scheduledAt: Date | null;
    published: boolean;
    createdAt: Date;
  };
  message?: Message;
}

export async function createAnnouncement(
  client: Client,
  data: CreateAnnouncementData,
): Promise<AnnouncementResult> {
  const embedData = data.title
    ? JSON.stringify({ title: data.title, description: data.content })
    : null;

  const announcement = await prisma.announcement.create({
    data: {
      guildId: data.guildId,
      channelId: data.channelId,
      content: data.content,
      embed: embedData,
      scheduledAt: data.scheduledAt ?? null,
      published: false,
    },
  });

  if (data.scheduledAt) {
    return { announcement };
  }

  const channel = await client.channels.fetch(data.channelId);
  if (!channel || !(channel instanceof TextChannel)) {
    throw new Error("Target channel is not a text channel or not found");
  }

  let message: Message;
  if (data.title) {
    const embed = new EmbedBuilder()
      .setTitle(data.title)
      .setDescription(data.content)
      .setColor("#5865F2")
      .setTimestamp();
    message = await channel.send({ embeds: [embed] });
  } else {
    message = await channel.send({ content: data.content });
  }

  await prisma.announcement.update({
    where: { id: announcement.id },
    data: { messageId: message.id, published: true },
  });

  return { announcement, message };
}

export async function processScheduledAnnouncements(client: Client): Promise<void> {
  try {
    const query = `
      UPDATE "Announcement"
      SET "processingStartedAt" = NOW()
      WHERE "scheduledAt" <= NOW()
        AND "published" = false
        AND "processingStartedAt" IS NULL
      RETURNING id, "channelId", content, embed, "guildId"
    `;

    const result: Array<{
      id: string;
      channelId: string;
      content: string;
      embed: string | null;
      guildId: string;
    }> = await prisma.$queryRawUnsafe(query);

    for (const announcement of result) {
      try {
        const channel = await client.channels.fetch(announcement.channelId);
        if (!channel || !(channel instanceof TextChannel)) {
          logger.error(
            `Channel ${announcement.channelId} not found for scheduled announcement ${announcement.id}`,
          );
          continue;
        }

        let message: Message;
        if (announcement.embed) {
          const embedData = JSON.parse(announcement.embed) as { title?: string };
          const embed = new EmbedBuilder()
            .setTitle(embedData.title ?? null)
            .setDescription(announcement.content)
            .setColor("#5865F2")
            .setTimestamp();
          message = await channel.send({ embeds: [embed] });
        } else {
          message = await channel.send({ content: announcement.content });
        }

        await prisma.announcement.update({
          where: { id: announcement.id },
          data: { messageId: message.id, published: true, processingStartedAt: null },
        });

        logger.info(`Sent scheduled announcement ${announcement.id} in ${announcement.guildId}`);
      } catch (error) {
        logger.error(`Failed to send scheduled announcement ${announcement.id}: ${error}`);
      }
    }
  } catch (error) {
    logger.error(`Failed to process scheduled announcements: ${error}`);
  }
}
