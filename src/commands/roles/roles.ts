import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ChannelType,
  GuildTextBasedChannel,
} from "discord.js";
import prisma from "../../services/prisma";
import { requireStaff } from "../../services/permissions";
import { safeDeferReply, safeEditReply } from "../../services/interactions";
import { brandedEmbed, successEmbed, errorEmbed } from "../../services/embeds";

export const data = new SlashCommandBuilder()
  .setName("roles")
  .setDescription("Manage reaction role panels")
  .addSubcommand((sub) =>
    sub
      .setName("panel")
      .setDescription("Create a reaction role panel")
      .addStringOption((opt) =>
        opt.setName("title").setDescription("Panel title").setRequired(true),
      )
      .addStringOption((opt) =>
        opt
          .setName("style")
          .setDescription("Button or dropdown style")
          .setRequired(true)
          .addChoices(
            { name: "Buttons", value: "button" },
            { name: "Dropdown", value: "dropdown" },
          ),
      )
      .addChannelOption((opt) =>
        opt
          .setName("channel")
          .setDescription("Channel to send panel to")
          .setRequired(true)
          .addChannelTypes(ChannelType.GuildText),
      ),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await safeDeferReply(interaction);

  const guildId = interaction.guildId;
  if (!guildId) {
    await safeEditReply(interaction, {
      embeds: [errorEmbed("This command can only be used in a server.")],
    });
    return;
  }

  const isStaff = await requireStaff(interaction);
  if (!isStaff) return;

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "panel") {
    await handlePanel(interaction, guildId);
  }
}

async function handlePanel(
  interaction: ChatInputCommandInteraction,
  guildId: string,
): Promise<void> {
  const title = interaction.options.getString("title", true);
  const style = interaction.options.getString("style", true);
  const channel = interaction.options.getChannel("channel", true) as GuildTextBasedChannel;

  const panel = await prisma.reactionRolePanel.create({
    data: {
      guildId,
      channelId: channel.id,
      title,
      style,
    },
  });

  const embed = await brandedEmbed(guildId);
  embed.setTitle(title);
  embed.setDescription("Select your roles below!");
  embed.setFooter({ text: `Panel ID: ${panel.id}` });

  const message = await channel.send({ embeds: [embed] });
  await prisma.reactionRolePanel.update({
    where: { id: panel.id },
    data: { messageId: message.id },
  });

  const responseEmbed = successEmbed(
    `Reaction role panel created in ${channel}!\n\n**Panel ID:** \`${panel.id}\`\n**Title:** ${title}\n**Style:** ${style}\n\nRole option management can be expanded - for now the panel is created and ready for options.`,
  );

  await safeEditReply(interaction, { embeds: [responseEmbed] });
}
