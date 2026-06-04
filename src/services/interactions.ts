import {
  InteractionReplyOptions,
  InteractionEditReplyOptions,
  MessagePayload,
  ChatInputCommandInteraction,
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  InteractionResponse,
  Message,
} from "discord.js";

type AnyInteraction = ChatInputCommandInteraction | ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction;

export async function safeDeferReply(
  interaction: AnyInteraction,
  ephemeral = false,
): Promise<void> {
  if (interaction.deferred || interaction.replied) return;
  try {
    await interaction.deferReply({ ephemeral });
  } catch (error) {
    console.error("Failed to defer reply:", error);
  }
}

export async function safeDeferUpdate(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
): Promise<void> {
  if (interaction.deferred || interaction.replied) return;
  try {
    await interaction.deferUpdate();
  } catch (error) {
    console.error("Failed to defer update:", error);
  }
}

export async function safeReply(
  interaction: AnyInteraction,
  options: string | InteractionReplyOptions | MessagePayload,
): Promise<InteractionResponse<boolean> | Message | undefined> {
  try {
    if (interaction.deferred) {
      return await interaction.editReply(options as string | MessagePayload | InteractionEditReplyOptions);
    }
    if (interaction.replied) {
      return await interaction.followUp(options);
    }
    return await interaction.reply(options);
  } catch (error) {
    console.error("Failed to reply:", error);
    return undefined;
  }
}

export async function safeEditReply(
  interaction: AnyInteraction,
  options: string | InteractionReplyOptions | MessagePayload,
): Promise<Message | undefined> {
  try {
    return await interaction.editReply(options as string | MessagePayload | InteractionEditReplyOptions);
  } catch (error) {
    console.error("Failed to edit reply:", error);
    return undefined;
  }
}

export async function safeFollowUp(
  interaction: AnyInteraction,
  options: string | InteractionReplyOptions | MessagePayload,
): Promise<Message | undefined> {
  try {
    return await interaction.followUp(options);
  } catch (error) {
    console.error("Failed to follow up:", error);
    return undefined;
  }
}
