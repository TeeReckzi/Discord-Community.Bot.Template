import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";
import { safeDeferReply, safeReply } from "../../services/interactions";
import { requireStaff } from "../../services/permissions";
import { successEmbed, errorEmbed } from "../../services/embeds";
import { logger } from "../../services/logger";
import { parseDuration } from "../../utils/duration";
import { createAnnouncement } from "../../modules/announcements/announcementManager";

export const data = new SlashCommandBuilder()
  .setName("announce")
  .setDescription("Create announcements")
  .addSubcommand((sub) =>
    sub
      .setName("create")
      .setDescription("Send an announcement to a channel")
      .addChannelOption((opt) =>
        opt.setName("channel").setDescription("Channel to announce in").setRequired(true),
      )
      .addStringOption((opt) =>
        opt.setName("content").setDescription("Announcement text").setRequired(true),
      )
      .addStringOption((opt) =>
        opt.setName("title").setDescription("Embed title (plain text if omitted)").setRequired(false),
      )
      .addRoleOption((opt) =>
        opt.setName("ping-role").setDescription("Role to ping").setRequired(false),
      )
      .addBooleanOption((opt) =>
        opt.setName("everyone").setDescription("Include @everyone ping").setRequired(false),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("schedule")
      .setDescription("Schedule an announcement for later")
      .addChannelOption((opt) =>
        opt.setName("channel").setDescription("Channel to announce in").setRequired(true),
      )
      .addStringOption((opt) =>
        opt.setName("content").setDescription("Announcement text").setRequired(true),
      )
      .addStringOption((opt) =>
        opt.setName("time").setDescription("Time from now (e.g. 1h, 30m, 2d)").setRequired(true),
      )
      .addStringOption((opt) =>
        opt.setName("title").setDescription("Embed title (plain text if omitted)").setRequired(false),
      ),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await safeDeferReply(interaction);

  if (!(await requireStaff(interaction))) return;

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "create") {
    await handleCreate(interaction);
  } else if (subcommand === "schedule") {
    await handleSchedule(interaction);
  }
}

async function handleCreate(interaction: ChatInputCommandInteraction): Promise<void> {
  const channel = interaction.options.getChannel("channel", true) as TextChannel;
  const content = interaction.options.getString("content", true);
  const title = interaction.options.getString("title");
  const pingRole = interaction.options.getRole("ping-role");
  const everyone = interaction.options.getBoolean("everyone");

  try {
    await createAnnouncement(interaction.client, {
      guildId: interaction.guildId!,
      channelId: channel.id,
      content,
      title: title ?? undefined,
    });

    const pings: string[] = [];
    if (everyone) pings.push("@everyone");
    if (pingRole) pings.push(`<@&${pingRole.id}>`);
    if (pings.length > 0) {
      await channel.send({ content: pings.join(" ") });
    }

    await safeReply(interaction, {
      embeds: [successEmbed(`Announcement sent to ${channel}`)],
    });
  } catch (error) {
    logger.error(`Failed to create announcement: ${error}`);
    await safeReply(interaction, {
      embeds: [errorEmbed("Failed to create announcement.")],
    });
  }
}

async function handleSchedule(interaction: ChatInputCommandInteraction): Promise<void> {
  const channel = interaction.options.getChannel("channel", true) as TextChannel;
  const content = interaction.options.getString("content", true);
  const time = interaction.options.getString("time", true);
  const title = interaction.options.getString("title");

  const durationMs = parseDuration(time);
  if (durationMs === null) {
    await safeReply(interaction, {
      embeds: [errorEmbed("Invalid duration. Use formats like `1h`, `30m`, `2d`.")],
    });
    return;
  }

  const scheduledAt = new Date(Date.now() + durationMs);

  try {
    await createAnnouncement(interaction.client, {
      guildId: interaction.guildId!,
      channelId: channel.id,
      content,
      title: title ?? undefined,
      scheduledAt,
    });

    const timestamp = Math.floor(scheduledAt.getTime() / 1000);

    await safeReply(interaction, {
      embeds: [successEmbed(`Announcement scheduled for <t:${timestamp}:f> in ${channel}`)],
    });
  } catch (error) {
    logger.error(`Failed to schedule announcement: ${error}`);
    await safeReply(interaction, {
      embeds: [errorEmbed("Failed to schedule announcement.")],
    });
  }
}
