import { Client, TextChannel } from "discord.js";
import prisma from "../../services/prisma";
import { brandedEmbed, successEmbed, errorEmbed } from "../../services/embeds";
import { logger } from "../../services/logger";

interface YouTubeSnippet {
  title: string;
  description: string;
  thumbnails: {
    high?: { url: string };
    medium?: { url: string };
    default?: { url: string };
  };
  publishedAt: string;
}

interface YouTubeSearchItem {
  id: { videoId: string };
  snippet: YouTubeSnippet;
}

interface YouTubeSearchResponse {
  items: YouTubeSearchItem[];
}

const YOUTUBE_BASE = "https://www.googleapis.com/youtube/v3";

async function sendYouTubeNotification(
  client: Client,
  guildId: string,
  channelId: string,
  item: YouTubeSearchItem,
  type: "upload" | "livestream",
): Promise<void> {
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !(channel instanceof TextChannel)) {
    logger.warn(`Channel ${channelId} not found or not a text channel for guild ${guildId}`);
    return;
  }

  const videoId = item.id.videoId;
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const thumbnail =
    item.snippet.thumbnails.high?.url ??
    item.snippet.thumbnails.medium?.url ??
    item.snippet.thumbnails.default?.url;

  const embed = await brandedEmbed(guildId);
  embed
    .setTitle(item.snippet.title)
    .setURL(url)
    .setDescription(item.snippet.description.slice(0, 200))
    .setImage(thumbnail ?? null)
    .setFooter({ text: type === "livestream" ? "YouTube Livestream" : "YouTube Upload" });

  await channel.send({ embeds: [embed] });
}

export async function checkYouTubeUploads(client: Client): Promise<void> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    logger.error("YOUTUBE_API_KEY environment variable is not set");
    return;
  }

  const configs = await prisma.socialFeedConfig.findMany({
    where: { platform: "youtube" },
  });

  for (const config of configs) {
    try {
      const url = `${YOUTUBE_BASE}/search?part=snippet&channelId=${config.channelId_or_username}&order=date&maxResults=1&type=video&key=${apiKey}`;

      const response = await fetch(url);
      if (!response.ok) {
        logger.error(`YouTube API responded with ${response.status} for channel ${config.channelId_or_username}`);
        continue;
      }

      const data = (await response.json()) as YouTubeSearchResponse;

      if (!data.items || data.items.length === 0) continue;

      const item = data.items[0];
      const publishedAt = new Date(item.snippet.publishedAt);

      if (config.lastChecked && publishedAt <= config.lastChecked) continue;

      await sendYouTubeNotification(client, config.guildId, config.channelId, item, "upload");

      await prisma.socialFeedConfig.update({
        where: { id: config.id },
        data: { lastChecked: publishedAt },
      });

      logger.info(`YouTube upload notification sent for ${config.channelId_or_username}`);
    } catch (error) {
      logger.error(`Error checking YouTube uploads for ${config.channelId_or_username}: ${error}`);
    }
  }
}

export async function checkYouTubeLivestreams(client: Client): Promise<void> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    logger.error("YOUTUBE_API_KEY environment variable is not set");
    return;
  }

  const configs = await prisma.socialFeedConfig.findMany({
    where: { platform: "youtube" },
  });

  for (const config of configs) {
    try {
      const url = `${YOUTUBE_BASE}/search?part=snippet&channelId=${config.channelId_or_username}&order=date&maxResults=1&type=video&eventType=live&key=${apiKey}`;

      const response = await fetch(url);
      if (!response.ok) {
        logger.error(`YouTube API responded with ${response.status} for channel ${config.channelId_or_username}`);
        continue;
      }

      const data = (await response.json()) as YouTubeSearchResponse;

      if (!data.items || data.items.length === 0) continue;

      const item = data.items[0];
      const publishedAt = new Date(item.snippet.publishedAt);

      if (config.lastChecked && publishedAt <= config.lastChecked) continue;

      await sendYouTubeNotification(client, config.guildId, config.channelId, item, "livestream");

      await prisma.socialFeedConfig.update({
        where: { id: config.id },
        data: { lastChecked: publishedAt },
      });

      logger.info(`YouTube livestream notification sent for ${config.channelId_or_username}`);
    } catch (error) {
      logger.error(`Error checking YouTube livestreams for ${config.channelId_or_username}: ${error}`);
    }
  }
}

/*
 * TikTok Stub
 *
 * Full TikTok integration requires:
 *   1. TikTok Business API access approval (https://developers.tiktok.com/)
 *   2. Access token via OAuth (requires TikTok developer account)
 *   3. API endpoint: https://open.tiktokapis.com/v2/video/list/
 *   4. Rate limits: 1000 requests/day per access token (Tier 1)
 *   5. Recommended: set up a webhook via TikTok's Webhook API instead of polling
 *
 * The Business API returns paginated video lists filtered by date.
 * Implementation would:
 *   - Obtain/refresh access token
 *   - POST to /v2/video/list/ with { fields: ["id","title","create_time","share_url"] }
 *   - Compare create_time against lastChecked
 *   - Send embed notifications for new posts
 */
export async function checkTikTokPosts(_client: Client): Promise<void> {
  logger.info("TikTok notifications require TikTok Business API access. See https://developers.tiktok.com/");
}

export async function addSocialFeed(
  guildId: string,
  channelId: string,
  platform: string,
  identifier: string,
): Promise<void> {
  await prisma.socialFeedConfig.upsert({
    where: {
      guildId_platform_channelId_or_username: {
        guildId,
        platform,
        channelId_or_username: identifier,
      },
    },
    update: { channelId },
    create: {
      guildId,
      channelId,
      platform,
      channelId_or_username: identifier,
    },
  });

  logger.info(`Social feed added: ${platform}/${identifier} -> #${channelId} in guild ${guildId}`);
}

export async function removeSocialFeed(
  guildId: string,
  platform: string,
  identifier: string,
): Promise<void> {
  await prisma.socialFeedConfig.deleteMany({
    where: {
      guildId,
      platform,
      channelId_or_username: identifier,
    },
  });

  logger.info(`Social feed removed: ${platform}/${identifier} from guild ${guildId}`);
}
