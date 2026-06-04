import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ChannelType,
} from "discord.js";

import { safeDeferReply, safeEditReply } from "../../services/interactions";
import { errorEmbed } from "../../services/embeds";
import { requireBotManager } from "../../services/permissions";
import { logger } from "../../services/logger";

import {
  handleSetup,
  handlePanel,
  handleClose,
  handleRename,
  handleMove,
  handleAddUser,
  handleRemoveUser,
} from "../../modules/tickets/ticketManager";

export const data = new SlashCommandBuilder()
  .setName("ticket")
  .setDescription("Ticket system commands")
  .addSubcommand((sub) =>
    sub
      .setName("setup")
      .setDescription("Set up a ticket category")
      .addStringOption((opt) =>
        opt.setName("name").setDescription("Category name").setRequired(true),
      )
      .addRoleOption((opt) =>
        opt
          .setName("staff-role")
          .setDescription("Staff role for this category")
          .setRequired(false),
      )
      .addChannelOption((opt) =>
        opt
          .setName("category")
          .setDescription("Discord category to create tickets under")
          .addChannelTypes(ChannelType.GuildCategory)
          .setRequired(false),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("panel")
      .setDescription("Create a ticket creation panel")
      .addStringOption((opt) =>
        opt.setName("title").setDescription("Panel title").setRequired(true),
      )
      .addStringOption((opt) =>
        opt
          .setName("description")
          .setDescription("Panel description")
          .setRequired(false),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("close")
      .setDescription("Close a ticket channel"),
  )
  .addSubcommand((sub) =>
    sub
      .setName("rename")
      .setDescription("Rename a ticket channel")
      .addStringOption((opt) =>
        opt.setName("name").setDescription("New channel name").setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("move")
      .setDescription("Move ticket to a different category")
      .addChannelOption((opt) =>
        opt.setName("category").setDescription("Target category").setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("add-user")
      .setDescription("Add a user to the ticket")
      .addUserOption((opt) =>
        opt.setName("user").setDescription("User to add").setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("remove-user")
      .setDescription("Remove a user from the ticket")
      .addUserOption((opt) =>
        opt.setName("user").setDescription("User to remove").setRequired(true),
      ),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  // /ticket close: allow the ticket creator OR a bot manager.
  // Other subcommands remain admin/staff-only.
  if (subcommand === "close") {
    if (!(await isTicketManagerOrCreator(interaction))) return;
  } else {
    if (!(await requireBotManager(interaction))) return;
  }

  try {
    switch (subcommand) {
      case "setup":
        await handleSetup(interaction);
        break;
      case "panel":
        await handlePanel(interaction);
        break;
      case "close":
        await handleClose(interaction);
        break;
      case "rename":
        await handleRename(interaction);
        break;
      case "move":
        await handleMove(interaction);
        break;
      case "add-user":
        await handleAddUser(interaction);
        break;
      case "remove-user":
        await handleRemoveUser(interaction);
        break;
      default:
        await safeDeferReply(interaction, true);
        await safeEditReply(interaction, {
          embeds: [errorEmbed("Unknown subcommand.")],
          ephemeral: true,
        });
    }
  } catch (error) {
    logger.error(`Error in ticket command (${subcommand}): ${error}`);
    if (!interaction.replied && !interaction.deferred) {
      await safeDeferReply(interaction, true);
    }
    try {
      await safeEditReply(interaction, {
        embeds: [errorEmbed("An error occurred while executing that command.")],
        ephemeral: true,
      });
    } catch {
      /* ignore */
    }
  }
}

/**
 * For /ticket close: allow the ticket creator OR a bot manager.
 * Defers the interaction on the deny path so the user always gets feedback.
 */
async function isTicketManagerOrCreator(
  interaction: ChatInputCommandInteraction,
): Promise<boolean> {
  const { canManageBot } = await import("../../services/permissions");
  if ((await canManageBot(interaction)).allowed) return true;

  // Allow the ticket creator. Look up by channel id.
  const { default: prisma } = await import("../../services/prisma");
  const channel = interaction.channel;
  if (!channel) return false;
  const ticket = await prisma.ticket.findUnique({ where: { channelId: channel.id } });
  if (ticket && ticket.creatorId === interaction.user.id) return true;

  // Deny: deferReply + edit with ephemeral error.
  await safeDeferReply(interaction, true);
  await safeEditReply(interaction, {
    embeds: [errorEmbed("Only the ticket creator or a server manager can close this ticket.")],
    ephemeral: true,
  });
  return false;
}
