import { EmbedBuilder, ColorResolvable } from "discord.js";
import prisma from "./prisma";

const DEFAULT_COLOR: ColorResolvable = "#5865F2";
export const BRAND_FOOTER_TEXT = "Aethoria's Keep";

export async function getBrandColor(guildId: string): Promise<ColorResolvable> {
  try {
    const config = await prisma.guildConfig.findUnique({
      where: { guildId },
    });
    return (config?.brandColor as ColorResolvable) ?? DEFAULT_COLOR;
  } catch {
    return DEFAULT_COLOR;
  }
}

export async function brandedEmbed(
  guildId: string,
): Promise<EmbedBuilder> {
  const color = await getBrandColor(guildId);
  return new EmbedBuilder()
    .setColor(color)
    .setTimestamp()
    .setFooter({ text: BRAND_FOOTER_TEXT });
}

export function successEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor("#57F287")
    .setDescription(`✅ ${message}`)
    .setTimestamp()
    .setFooter({ text: BRAND_FOOTER_TEXT });
}

export function errorEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor("#ED4245")
    .setDescription(`❌ ${message}`)
    .setTimestamp()
    .setFooter({ text: BRAND_FOOTER_TEXT });
}

export function warnEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor("#FEE75C")
    .setDescription(`⚠️ ${message}`)
    .setTimestamp()
    .setFooter({ text: BRAND_FOOTER_TEXT });
}

export function infoEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(DEFAULT_COLOR)
    .setDescription(`ℹ️ ${message}`)
    .setTimestamp()
    .setFooter({ text: BRAND_FOOTER_TEXT });
}
