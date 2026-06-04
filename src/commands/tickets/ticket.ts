import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  GuildMember,
  PermissionFlagsBits,
} from "discord.js";

import { safeDeferReply, safeReply } from "../../services/interactions";
import { errorEmbed } from "../../services/embeds";
import { requireStaff } from "../../services/permissions";
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

const STAFF_ONLY_SUBCOMMANDS = ["setup", "close", "rename", "move", "add-user", "remove-user"];

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
  if (!interaction.guild) {
    await safeReply(interaction, { embeds: [errorEmbed("This command can only be used in a server.")], ephemeral: true });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand !== "panel" && STAFF_ONLY_SUBCOMMANDS.includes(subcommand)) {
    const isStaff = await requireStaff(interaction, true);
    if (!isStaff) {
      const hasAdmin = interaction.member instanceof GuildMember &&
        (interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
         interaction.member.permissions.has(PermissionFlagsBits.ManageGuild));
      if (!hasAdmin) {
        const config = await (await import("../../services/prisma")).default
          .guildConfig
          .findUnique({ where: { guildId: interaction.guild.id } });
        const staffRole = config?.staffRole;
        const roleCheck = staffRole && interaction.member instanceof GuildMember
          ? interaction.member.roles.cache.has(staffRole)
          : false;
        if (!roleCheck) {
          await safeReply(interaction, {
            embeds: [errorEmbed("You need the **Administrator**, **Manage Server**, or configured staff role to use this command.")],
            ephemeral: true,
          });
          return;
        }
      }
    }
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
        await safeReply(interaction, { embeds: [errorEmbed("Unknown subcommand.")], ephemeral: true });
    }
  } catch (error) {
    logger.error(`Error in ticket command (${subcommand}): ${error}`);
    if (!interaction.replied && !interaction.deferred) {
      await safeReply(interaction, { embeds: [errorEmbed("An error occurred while executing that command.")], ephemeral: true });
    } else {
      await interaction.editReply({ embeds: [errorEmbed("An error occurred while executing that command.")] }).catch(() => {});
    }
  }
}
