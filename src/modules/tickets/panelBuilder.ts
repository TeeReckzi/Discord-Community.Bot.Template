import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ColorResolvable,
} from "discord.js";
import { BRAND_FOOTER_TEXT } from "../../services/embeds";

export type PanelMode = "button" | "dropdown";

export interface PanelContentInput {
  title: string;
  description?: string | null;
  mode: PanelMode;
  /**
   * All categories in the guild. For "button" mode, only the single
   * bound category should appear in the select. For "dropdown" mode,
   * the full list is used.
   */
  categories: Array<{ id: string; name: string }>;
  /**
   * For "button" mode, the bound category. For "dropdown" mode, ignored.
   */
  boundCategoryId?: string | null;
  color: ColorResolvable;
}

const DEFAULT_DESCRIPTION = "Click the button below to create a ticket.";

export function buildPanelEmbed(input: PanelContentInput): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(input.color)
    .setTitle(input.title)
    .setDescription(input.description ?? DEFAULT_DESCRIPTION)
    .setFooter({ text: BRAND_FOOTER_TEXT })
    .setTimestamp();

  if (input.mode === "dropdown") {
    embed.addFields({
      name: "Categories",
      value: input.categories.map((c) => `• ${c.name}`).join("\n") || "None configured",
    });
  }

  return embed;
}

export function buildPanelComponents(input: PanelContentInput): ActionRowBuilder<
  ButtonBuilder | StringSelectMenuBuilder
>[] {
  if (input.mode === "button") {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket_create")
        .setLabel("Create Ticket")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("🎫"),
    );
    return [row];
  }

  // dropdown mode
  const select = new StringSelectMenuBuilder()
    .setCustomId("ticket_panel_select")
    .setPlaceholder("Select a ticket category")
    .addOptions(
      input.categories.map(
        (c) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(c.name)
            .setDescription(`Create a ticket in ${c.name}`)
            .setValue(c.id)
            .setEmoji("📂"),
      ),
    );
  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
  return [row];
}
