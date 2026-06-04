import {
  Events,
  Interaction,
  ChatInputCommandInteraction,
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
} from "discord.js";
import { logger } from "../services/logger";
import { handlePollVote } from "../modules/polls/pollManager";
import {
  handleTicketCreateButton,
  handleTicketCategorySelect,
  handleTicketModalSubmit,
} from "../modules/tickets/ticketManager";
import {
  handleRoleButton,
  handleRoleDropdown,
} from "../modules/roles/roleManager";

export default {
  name: Events.InteractionCreate,
  once: false,
  async execute(interaction: Interaction): Promise<void> {
    const label = describeInteraction(interaction);
    logger.info(`Received interaction: ${label}`);

    try {
      if (interaction.isChatInputCommand()) {
        await handleSlashCommand(interaction);
      } else if (interaction.isButton()) {
        await handleButton(interaction);
      } else if (interaction.isStringSelectMenu()) {
        await handleSelectMenu(interaction);
      } else if (interaction.isModalSubmit()) {
        await handleModalSubmit(interaction);
      } else {
        logger.debug(`Unhandled interaction type: ${interaction.type}`);
      }
    } catch (error) {
      logger.error(`Unhandled error in interactionCreate for ${label}: ${error}`);
      await safeErrorReply(interaction, "An unexpected error occurred while handling this interaction.");
    }
  },
};

function describeInteraction(interaction: Interaction): string {
  if (interaction.isChatInputCommand()) {
    return `type=slash command=/${interaction.commandName}`;
  }
  if (interaction.isButton()) {
    return `type=button customId=${interaction.customId}`;
  }
  if (interaction.isStringSelectMenu()) {
    return `type=selectMenu customId=${interaction.customId}`;
  }
  if (interaction.isModalSubmit()) {
    return `type=modalSubmit customId=${interaction.customId}`;
  }
  return `type=${interaction.type}`;
}

async function safeErrorReply(interaction: Interaction, message: string): Promise<void> {
  try {
    if (!interaction.isRepliable()) return;
    const ephemeral = { ephemeral: true } as const;
    if (interaction.deferred) {
      await interaction.editReply({ content: message });
    } else if (interaction.replied) {
      await interaction.followUp({ content: message, ...ephemeral });
    } else {
      await interaction.reply({ content: message, ...ephemeral });
    }
  } catch (replyError) {
    logger.error(`Failed to send error reply: ${replyError}`);
  }
}

async function handleSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const command = (interaction.client as any).commands?.get(interaction.commandName);
  if (!command) {
    logger.warn(`Unknown command received: /${interaction.commandName}`);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: `Unknown command: \`/${interaction.commandName}\``,
        ephemeral: true,
      });
    }
    return;
  }

  try {
    logger.info(`Executing /${interaction.commandName} for user=${interaction.user.id} guild=${interaction.guildId}`);
    await command.execute(interaction);
  } catch (error) {
    logger.error(`Error executing /${interaction.commandName}: ${error}`);
    await safeErrorReply(interaction, "There was an error executing this command.");
  }
}

async function handleButton(interaction: ButtonInteraction): Promise<void> {
  const customId = interaction.customId;

  if (customId === "ticket_create") {
    await handleTicketCreateButton(interaction);
    return;
  }

  const parts = customId.split("_");
  const prefix = parts[0];

  if (prefix === "poll") {
    // customId format: poll_vote_{pollId}_{optionIndex}
    const [, , pollId, optionIndexStr] = parts;
    if (!pollId || optionIndexStr === undefined) {
      logger.debug(`Invalid poll button customId: ${customId}`);
      return;
    }
    await handlePollVote(interaction, pollId, parseInt(optionIndexStr, 10));
    return;
  }

  if (parts[0] === "role" && parts[1] === "btn" && parts.length >= 4) {
    const panelId = parts[2];
    const roleId = parts.slice(3).join("_");
    await handleRoleButton(interaction, panelId, roleId);
    return;
  }

  logger.debug(`No button handler for: ${customId}`);
}

async function handleSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
  const customId = interaction.customId;

  if (customId === "ticket_panel_select") {
    await handleTicketCategorySelect(interaction);
    return;
  }

  const parts = customId.split("_");

  if (parts[0] === "role" && parts[1] === "dd" && parts.length >= 3) {
    const panelId = parts.slice(2).join("_");
    await handleRoleDropdown(interaction, panelId);
    return;
  }

  logger.debug(`No select menu handler for: ${customId}`);
}

async function handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  const customId = interaction.customId;

  if (customId.startsWith("ticket_modal_")) {
    await handleTicketModalSubmit(interaction);
    return;
  }

  logger.debug(`No modal submit handler for: ${customId}`);
}
