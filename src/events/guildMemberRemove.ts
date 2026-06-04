import { Events, GuildMember, TextChannel, EmbedBuilder } from "discord.js";
import prisma from "../services/prisma";
import { logger } from "../services/logger";

export default {
  name: Events.GuildMemberRemove,
  once: false,
  async execute(member: GuildMember): Promise<void> {
    try {
      const config = await prisma.welcomeLeaveConfig.findUnique({
        where: { guildId_type: { guildId: member.guild.id, type: "leave" } },
      });

      if (!config || config.type !== "leave") return;
      if (!config.channelId) return;

      const channel = member.guild.channels.cache.get(config.channelId) as TextChannel;
      if (!channel) return;

      const variables: Record<string, string> = {
        "{user}": member.user.tag,
        "{server}": member.guild.name,
        "{memberCount}": member.guild.memberCount.toString(),
      };

      let message = config.message;
      for (const [key, value] of Object.entries(variables)) {
        message = message.replace(new RegExp(key.replace(/[{}]/g, "\\{?\\}?"), "g"), value);
      }

      if (config.embedEnabled) {
        const embed = new EmbedBuilder()
          .setColor((config.embedColor as any) || "#ED4245")
          .setTitle(config.embedTitle || "Goodbye!")
          .setDescription(message)
          .setThumbnail(member.user.displayAvatarURL())
          .setTimestamp();

        await channel.send({ embeds: [embed] });
      } else {
        await channel.send(message);
      }
    } catch (error) {
      logger.error(`Leave message error: ${error}`);
    }
  },
};
