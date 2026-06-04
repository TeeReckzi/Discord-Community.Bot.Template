import {
  ButtonInteraction,
  StringSelectMenuInteraction,
  GuildMember,
} from "discord.js";
import prisma from "../../services/prisma";
import { safeDeferUpdate, safeFollowUp } from "../../services/interactions";
import { logger } from "../../services/logger";

export async function handleRoleButton(
  interaction: ButtonInteraction,
  panelId: string,
  roleId: string,
): Promise<void> {
  await safeDeferUpdate(interaction);

  if (!(interaction.member instanceof GuildMember)) {
    await safeFollowUp(interaction, {
      content: "Could not identify your member data.",
      ephemeral: true,
    });
    return;
  }

  const member = interaction.member as GuildMember;

  try {
    const hasRole = member.roles.cache.has(roleId);

    if (hasRole) {
      await member.roles.remove(roleId);
      await safeFollowUp(interaction, {
        content: `<@&${roleId}> has been removed.`,
        ephemeral: true,
      });
    } else {
      await member.roles.add(roleId);
      await safeFollowUp(interaction, {
        content: `<@&${roleId}> has been added.`,
        ephemeral: true,
      });
    }
  } catch (error) {
    logger.error(`Failed to toggle role ${roleId} for ${member.id}: ${error}`);
    await safeFollowUp(interaction, {
      content:
        "Failed to update your roles. Check my permissions and try again.",
      ephemeral: true,
    });
  }
}

export async function handleRoleDropdown(
  interaction: StringSelectMenuInteraction,
  panelId: string,
): Promise<void> {
  await safeDeferUpdate(interaction);

  if (!(interaction.member instanceof GuildMember)) {
    await safeFollowUp(interaction, {
      content: "Could not identify your member data.",
      ephemeral: true,
    });
    return;
  }

  const member = interaction.member as GuildMember;
  const selectedRoleIds = interaction.values;

  try {
    const panel = await prisma.reactionRolePanel.findUnique({
      where: { id: panelId },
      include: { options: true },
    });

    if (!panel) {
      await safeFollowUp(interaction, {
        content: "This role panel no longer exists.",
        ephemeral: true,
      });
      return;
    }

    const panelRoleIds = new Set(panel.options.map((o) => o.roleId));
    const toAdd = selectedRoleIds.filter((id) => !member.roles.cache.has(id));
    const toRemove = member.roles.cache
      .filter((r) => panelRoleIds.has(r.id) && !selectedRoleIds.includes(r.id))
      .map((r) => r.id);

    if (toAdd.length > 0) {
      await member.roles.add(toAdd);
    }

    if (toRemove.length > 0) {
      await member.roles.remove(toRemove);
    }

    const parts: string[] = [];
    if (toAdd.length > 0) {
      parts.push(`Added: ${toAdd.map((id) => `<@&${id}>`).join(", ")}`);
    }
    if (toRemove.length > 0) {
      parts.push(`Removed: ${toRemove.map((id) => `<@&${id}>`).join(", ")}`);
    }

    const message =
      parts.length > 0
        ? parts.join("\n")
        : "No role changes were made.";

    await safeFollowUp(interaction, {
      content: message,
      ephemeral: true,
    });
  } catch (error) {
    logger.error(
      `Failed to process dropdown roles for panel ${panelId}: ${error}`,
    );
    await safeFollowUp(interaction, {
      content:
        "Failed to update your roles. Check my permissions and try again.",
      ephemeral: true,
    });
  }
}
