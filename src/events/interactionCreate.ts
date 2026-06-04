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
    try {
      if (interaction.isChatInputCommand()) {
        await handleSlashCommand(interaction);
      } else if (interaction.isButton()) {
        await handleButton(interaction);
      } else if (interaction.isStringSelectMenu()) {
        await handleSelectMenu(interaction);
      } else if (interaction.isModalSubmit()) {
        await handleModalSubmit(interaction);
      }
    } catch (error) {
      logger.error(`Unhandled error in interactionCreate: ${error}`);
    }
  },
};

async function handleSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const command = (interaction.client as any).commands?.get(interaction.commandName);
  if (!command) {
    logger.warn(`Unknown command: ${interaction.commandName}`);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "This command is not recognized.",
        ephemeral: true,
      });
    }
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    logger.error(`Error executing command ${interaction.commandName}: ${error}`);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "There was an error executing this command.",
        ephemeral: true,
      });
    } else {
      await interaction.editReply({
        content: "There was an error executing this command.",
      });
    }
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
