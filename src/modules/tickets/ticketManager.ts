import {
  Guild,
  TextChannel,
  ChannelType,
  PermissionFlagsBits,
  GuildMember,
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  AttachmentBuilder,
} from "discord.js";

import prisma from "../../services/prisma";
import { logger } from "../../services/logger";
import { generateTranscript, transcriptToBuffer, transcriptFilename } from "../../utils/transcripts";
import { safeDeferReply, safeDeferUpdate, safeReply, safeEditReply, safeFollowUp } from "../../services/interactions";
import { brandedEmbed, successEmbed, errorEmbed, getBrandColor } from "../../services/embeds";
import { buildPanelEmbed, buildPanelComponents, PanelMode } from "./panelBuilder";

const TICKET_PREFIX = "ticket-";

async function createAuditLog(
  guildId: string,
  action: string,
  moderator: string,
  target: string | null = null,
  reason: string | null = null,
  details: string | null = null,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        guildId,
        action,
        moderator,
        target: target ?? undefined,
        reason: reason ?? undefined,
        details: details ?? undefined,
      },
    });
  } catch (error) {
    logger.error(`Failed to create audit log: ${error}`);
  }
}

async function getGuildStaffRole(guildId: string): Promise<string | null> {
  try {
    const config = await prisma.guildConfig.findUnique({ where: { guildId } });
    return config?.staffRole ?? null;
  } catch {
    return null;
  }
}

async function addCreatorToTicket(
  channel: TextChannel,
  creator: GuildMember,
): Promise<void> {
  await channel.permissionOverwrites.create(creator, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true,
    AddReactions: true,
    AttachFiles: true,
  });
}

async function addStaffToTicket(
  channel: TextChannel,
  staffRoleId: string,
): Promise<void> {
  await channel.permissionOverwrites.create(staffRoleId, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true,
    AddReactions: true,
    AttachFiles: true,
    ManageMessages: true,
  });
}

async function denyEveryone(channel: TextChannel): Promise<void> {
  await channel.permissionOverwrites.create(channel.guild.roles.everyone, {
    ViewChannel: false,
    SendMessages: false,
    ReadMessageHistory: false,
  });
}

async function isTicketChannel(channelId: string): Promise<boolean> {
  try {
    const ticket = await prisma.ticket.findUnique({ where: { channelId } });
    return ticket !== null && ticket.status === "open";
  } catch {
    return false;
  }
}

async function getTicket(
  channelId: string,
  options: { requireOpen?: boolean } = {},
) {
  try {
    const ticket = await prisma.ticket.findUnique({ where: { channelId } });
    if (!ticket) return null;
    if (options.requireOpen && ticket.status !== "open") return null;
    return ticket;
  } catch {
    return null;
  }
}

async function sendToLogChannel(
  guild: Guild,
  payload: { embeds?: any[]; files?: any[]; content?: string },
): Promise<void> {
  try {
    const config = await prisma.guildConfig.findUnique({ where: { guildId: guild.id } });
    if (!config?.logChannel) return;
    const logChannel = guild.channels.cache.get(config.logChannel) as TextChannel | undefined;
    if (logChannel) {
      await logChannel.send(payload);
    }
  } catch (error) {
    logger.error(`Failed to send to log channel: ${error}`);
  }
}

// ─── Setup ──────────────────────────────────────────────────

export async function handleSetup(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guild) {
    await safeReply(interaction, { embeds: [errorEmbed("This command can only be used in a server.")], ephemeral: true });
    return;
  }

  const name = interaction.options.getString("name", true);
  const staffRole = interaction.options.getRole("staff-role");
  const category = interaction.options.getChannel("category");

  if (category && category.type !== ChannelType.GuildCategory) {
    await safeReply(interaction, {
      embeds: [errorEmbed("Please select a Discord category channel, not a text channel.")],
      ephemeral: true,
    });
    return;
  }

  const existing = await prisma.ticketCategory.findFirst({
    where: { guildId: interaction.guild.id, name },
  });

  if (existing) {
    await safeReply(interaction, { embeds: [errorEmbed(`A ticket category named **${name}** already exists.`)], ephemeral: true });
    return;
  }

  const data: any = {
    guildId: interaction.guild.id,
    name,
    categoryId: category?.id ?? null,
    staffRole: staffRole?.id ?? null,
  };

  await prisma.ticketCategory.create({ data });

  await createAuditLog(
    interaction.guild.id,
    "ticket_setup",
    interaction.user.id,
    null,
    null,
    `Created ticket category "${name}"`,
  );

  const embed = await brandedEmbed(interaction.guild.id);
  embed.setTitle("Ticket Category Created");
  embed.setDescription(`Category **${name}** has been set up.`);
  embed.addFields(
    { name: "Staff Role", value: staffRole ? `<@&${staffRole.id}>` : "Server default", inline: true },
    { name: "Category", value: category ? `<#${category.id}>` : "None (creates at top level)", inline: true },
  );

  await safeReply(interaction, { embeds: [embed] });
}

// ─── Panel ──────────────────────────────────────────────────

export async function handlePanel(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guild || !interaction.channel) {
    await safeReply(interaction, { embeds: [errorEmbed("This command can only be used in a server.")], ephemeral: true });
    return;
  }

  const title = interaction.options.getString("title", true);
  const description = interaction.options.getString("description");

  // Look up categories to pick the right mode. The /ticket panel command
  // also persists a TicketPanel row so the dashboard can list, recreate,
  // and manage it. The panel's mode is derived from the category count.
  const categories = await prisma.ticketCategory.findMany({
    where: { guildId: interaction.guild.id },
    select: { id: true, name: true },
  });

  if (categories.length === 0) {
    await safeReply(interaction, {
      embeds: [errorEmbed("Set up at least one ticket category first with `/ticket setup`.")],
      ephemeral: true,
    });
    return;
  }

  const mode: "button" | "dropdown" = categories.length === 1 ? "button" : "dropdown";
  const boundCategoryId = mode === "button" ? categories[0].id : null;

  const color = await getBrandColor(interaction.guild.id);
  const panelInput = {
    title,
    description,
    mode,
    categories,
    boundCategoryId,
    color,
  };

  const embed = buildPanelEmbed(panelInput);
  const rows = buildPanelComponents(panelInput);

  // requireBotManager deferred the reply already; send the panel
  // message into the channel via editReply (the slash command's reply
  // IS the panel message).
  const sentMessage = await safeEditReply(interaction, { embeds: [embed], components: rows });
  const messageId = sentMessage?.id ?? null;

  // Persist the panel. If the DB write fails after the message is already
  // sent, log loudly but don't fail the user-facing command — the panel
  // is already visible, the dashboard just won't be able to re-create it.
  try {
    // Ensure GuildConfig exists to satisfy TicketPanel FK constraint.
    // This is a no-op if the row already exists.
    await prisma.guildConfig.upsert({
      where: { guildId: interaction.guild.id },
      update: {},
      create: { guildId: interaction.guild.id },
    });

    const panel = await prisma.ticketPanel.create({
      data: {
        guildId: interaction.guild.id,
        channelId: interaction.channel.id,
        messageId,
        title,
        description: description ?? null,
        mode,
        categoryId: boundCategoryId,
        createdById: interaction.user.id,
        archived: false,
      },
    });

    await createAuditLog(
      interaction.guild.id,
      "ticket_panel_create",
      interaction.user.id,
      panel.id,
      null,
      `Created ticket panel "${title}" in <#${interaction.channel.id}> (${mode})`,
    );

    logger.info(
      `TicketPanel ${panel.id} persisted for guild ${interaction.guild.id} (message ${messageId ?? "unknown"})`,
    );
  } catch (error) {
    logger.error(
      `TicketPanel DB save FAILED for guild ${interaction.guild.id} (panel message already sent): ${error}`,
    );
  }
}

// ─── Close ──────────────────────────────────────────────────

export async function handleClose(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guild || !interaction.channel) {
    await safeReply(interaction, { embeds: [errorEmbed("This command can only be used in a server.")], ephemeral: true });
    return;
  }

  const channel = interaction.channel as TextChannel;
  const ticket = await getTicket(channel.id, { requireOpen: true });

  if (!ticket) {
    await safeReply(interaction, { embeds: [errorEmbed("This channel is not an open ticket.")], ephemeral: true });
    return;
  }

  await safeDeferReply(interaction);

  try {
    const transcript = await generateTranscript(channel);
    const attachment = new AttachmentBuilder(transcriptToBuffer(transcript), {
      name: transcriptFilename(channel.name),
    });

    await prisma.ticket.update({
      where: { channelId: channel.id },
      data: {
        status: "closed",
        closedAt: new Date(),
        closedBy: interaction.user.id,
        transcript,
      },
    });

    await createAuditLog(
      interaction.guild.id,
      "ticket_close",
      interaction.user.id,
      ticket.creatorId,
      null,
      `Closed ticket #${channel.name} (${ticket.id})`,
    );

    const embed = successEmbed(`Ticket **${channel.name}** has been closed.`);
    await safeEditReply(interaction, { embeds: [embed] });

    const logEmbed = await brandedEmbed(interaction.guild.id);
    logEmbed.setTitle("Ticket Closed");
    logEmbed.setDescription(`Ticket **${channel.name}** was closed by <@${interaction.user.id}>.`);
    logEmbed.addFields(
      { name: "Creator", value: `<@${ticket.creatorId}>`, inline: true },
      { name: "Subject", value: ticket.subject ?? "No subject", inline: true },
    );
    await sendToLogChannel(interaction.guild, {
      embeds: [logEmbed],
      files: [attachment],
    });

    // Best-effort DM the transcript to the creator. If the user has
    // DMs closed this silently no-ops; the log channel still has the file.
    try {
      const creator = await interaction.client.users.fetch(ticket.creatorId);
      const dmEmbed = await brandedEmbed(interaction.guild.id);
      dmEmbed.setTitle(`Ticket Closed - ${channel.name}`);
      dmEmbed.setDescription(
        `Your ticket in **${interaction.guild.name}** was closed by <@${interaction.user.id}>.\n` +
          `A transcript is attached.`,
      );
      await creator.send({ embeds: [dmEmbed], files: [attachment] });
    } catch (dmError) {
      logger.debug(`Could not DM ticket creator ${ticket.creatorId}: ${dmError}`);
    }

    await channel.delete();
    logger.info(`Deleted ticket channel: ${channel.name}`);
  } catch (error) {
    logger.error(`Failed to close ticket: ${error}`);
    await safeEditReply(interaction, { embeds: [errorEmbed("Failed to close the ticket. Please try again.")] });
  }
}

// ─── Rename ─────────────────────────────────────────────────

export async function handleRename(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guild || !interaction.channel) {
    await safeReply(interaction, { embeds: [errorEmbed("This command can only be used in a server.")], ephemeral: true });
    return;
  }

  const channel = interaction.channel as TextChannel;
  const ticket = await getTicket(channel.id, { requireOpen: true });

  if (!ticket) {
    await safeReply(interaction, { embeds: [errorEmbed("This channel is not an open ticket.")], ephemeral: true });
    return;
  }

  const newName = interaction.options.getString("name", true);
  const sanitized = `${TICKET_PREFIX}${newName.replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase().slice(0, 90)}`;

  try {
    await channel.setName(sanitized);
    await prisma.ticket.update({
      where: { channelId: channel.id },
      data: { subject: newName },
    });

    await createAuditLog(
      interaction.guild.id,
      "ticket_rename",
      interaction.user.id,
      ticket.creatorId,
      null,
      `Renamed ticket from "${channel.name}" to "${sanitized}"`,
    );

    const logEmbed = await brandedEmbed(interaction.guild.id);
    logEmbed.setTitle("Ticket Renamed");
    logEmbed.setDescription(`<@${interaction.user.id}> renamed ticket **${channel.name}** to **${sanitized}**.`);
    await sendToLogChannel(interaction.guild, { embeds: [logEmbed] });

    await safeReply(interaction, { embeds: [successEmbed(`Ticket renamed to **${sanitized}**.`)] });
  } catch (error) {
    logger.error(`Failed to rename ticket: ${error}`);
    await safeReply(interaction, { embeds: [errorEmbed("Failed to rename the ticket.")] });
  }
}

// ─── Move ──────────────────────────────────────────────────

export async function handleMove(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guild || !interaction.channel) {
    await safeReply(interaction, { embeds: [errorEmbed("This command can only be used in a server.")], ephemeral: true });
    return;
  }

  const channel = interaction.channel as TextChannel;
  const ticket = await getTicket(channel.id, { requireOpen: true });

  if (!ticket) {
    await safeReply(interaction, { embeds: [errorEmbed("This channel is not an open ticket.")], ephemeral: true });
    return;
  }

  const targetCategory = interaction.options.getChannel("category", true);

  if (targetCategory.type !== ChannelType.GuildCategory) {
    await safeReply(interaction, { embeds: [errorEmbed("The selected channel must be a category.")], ephemeral: true });
    return;
  }

  try {
    await channel.setParent(targetCategory.id, { lockPermissions: false });

    await createAuditLog(
      interaction.guild.id,
      "ticket_move",
      interaction.user.id,
      ticket.creatorId,
      null,
      `Moved ticket to category "${targetCategory.name}"`,
    );

    const logEmbed = await brandedEmbed(interaction.guild.id);
    logEmbed.setTitle("Ticket Moved");
    logEmbed.setDescription(`<@${interaction.user.id}> moved ticket **${channel.name}** to category **${targetCategory.name}**.`);
    await sendToLogChannel(interaction.guild, { embeds: [logEmbed] });

    await safeReply(interaction, { embeds: [successEmbed(`Ticket moved to category **${targetCategory.name}**.`)] });
  } catch (error) {
    logger.error(`Failed to move ticket: ${error}`);
    await safeReply(interaction, { embeds: [errorEmbed("Failed to move the ticket.")] });
  }
}

// ─── Add User ──────────────────────────────────────────────

export async function handleAddUser(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guild || !interaction.channel) {
    await safeReply(interaction, { embeds: [errorEmbed("This command can only be used in a server.")], ephemeral: true });
    return;
  }

  const channel = interaction.channel as TextChannel;
  const ticket = await getTicket(channel.id, { requireOpen: true });

  if (!ticket) {
    await safeReply(interaction, { embeds: [errorEmbed("This channel is not an open ticket.")], ephemeral: true });
    return;
  }

  const targetUser = interaction.options.getUser("user", true);
  let member: GuildMember;
  try {
    member = await interaction.guild.members.fetch(targetUser.id);
  } catch {
    await safeReply(interaction, { embeds: [errorEmbed("That user is not in this server.")], ephemeral: true });
    return;
  }

  try {
    await channel.permissionOverwrites.create(member, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      AddReactions: true,
      AttachFiles: true,
    });

    await createAuditLog(
      interaction.guild.id,
      "ticket_add_user",
      interaction.user.id,
      targetUser.id,
      null,
      `Added <@${member.id}> to ticket`,
    );

    const logEmbed = await brandedEmbed(interaction.guild.id);
    logEmbed.setTitle("Ticket: User Added");
    logEmbed.setDescription(`<@${interaction.user.id}> added <@${member.id}> to ticket **${channel.name}**.`);
    await sendToLogChannel(interaction.guild, { embeds: [logEmbed] });

    await safeReply(interaction, { embeds: [successEmbed(`Added **${member.user.tag}** to the ticket.`)] });
  } catch (error) {
    logger.error(`Failed to add user to ticket: ${error}`);
    await safeReply(interaction, { embeds: [errorEmbed("Failed to add user to the ticket.")] });
  }
}

// ─── Remove User ───────────────────────────────────────────

export async function handleRemoveUser(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guild || !interaction.channel) {
    await safeReply(interaction, { embeds: [errorEmbed("This command can only be used in a server.")], ephemeral: true });
    return;
  }

  const channel = interaction.channel as TextChannel;
  const ticket = await getTicket(channel.id, { requireOpen: true });

  if (!ticket) {
    await safeReply(interaction, { embeds: [errorEmbed("This channel is not an open ticket.")], ephemeral: true });
    return;
  }

  const targetUser = interaction.options.getUser("user", true);

  if (targetUser.id === ticket.creatorId) {
    await safeReply(interaction, { embeds: [errorEmbed("You cannot remove the ticket creator from the ticket.")], ephemeral: true });
    return;
  }

  try {
    await channel.permissionOverwrites.delete(targetUser.id);

    await createAuditLog(
      interaction.guild.id,
      "ticket_remove_user",
      interaction.user.id,
      targetUser.id,
      null,
      `Removed <@${targetUser.id}> from ticket`,
    );

    const logEmbed = await brandedEmbed(interaction.guild.id);
    logEmbed.setTitle("Ticket: User Removed");
    logEmbed.setDescription(`<@${interaction.user.id}> removed <@${targetUser.id}> from ticket **${channel.name}**.`);
    await sendToLogChannel(interaction.guild, { embeds: [logEmbed] });

    await safeReply(interaction, { embeds: [successEmbed(`Removed **${targetUser.tag}** from the ticket.`)] });
  } catch (error) {
    logger.error(`Failed to remove user from ticket: ${error}`);
    await safeReply(interaction, { embeds: [errorEmbed("Failed to remove user from the ticket.")] });
  }
}

// ─── Button: Create Ticket ─────────────────────────────────

export async function handleTicketCreateButton(
  interaction: ButtonInteraction,
): Promise<void> {
  if (!interaction.guild) {
    await safeReply(interaction, { embeds: [errorEmbed("This can only be used in a server.")], ephemeral: true });
    return;
  }

  const categories = await prisma.ticketCategory.findMany({
    where: { guildId: interaction.guild.id },
  });

  if (categories.length === 0) {
    await safeReply(interaction, {
      embeds: [errorEmbed("No ticket categories have been configured. Please ask an admin to run `/ticket setup`.")],
      ephemeral: true,
    });
    return;
  }

  // Single category: open the modal directly. A modal is itself a fresh
  // interaction response, so we must NOT have deferred or replied first.
  if (categories.length === 1) {
    const modal = buildSubjectModal(categories[0].id, categories[0].name);
    await interaction.showModal(modal);
    return;
  }

  // Multiple categories: defer the button update (the message stays put),
  // then edit with a select menu. After deferUpdate, the only valid
  // follow-ups are editReply / followUp — never showModal.
  await safeDeferUpdate(interaction);

  const select = new StringSelectMenuBuilder()
    .setCustomId("ticket_panel_select")
    .setPlaceholder("Select a ticket category")
    .addOptions(
      categories.map((cat) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(cat.name)
          .setDescription(`Create a ticket in ${cat.name}`)
          .setValue(cat.id)
          .setEmoji("📂"),
      ),
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
  await safeEditReply(interaction, {
    embeds: [(await brandedEmbed(interaction.guild.id)).setTitle("Select Category").setDescription("Please choose a category for your ticket.")],
    components: [row],
  });
}

// ─── Select Menu: Category ─────────────────────────────────

export async function handleTicketCategorySelect(
  interaction: StringSelectMenuInteraction,
): Promise<void> {
  if (!interaction.guild) {
    await safeReply(interaction, { embeds: [errorEmbed("This can only be used in a server.")], ephemeral: true });
    return;
  }

  const categoryId = interaction.values[0];
  const category = await prisma.ticketCategory.findUnique({ where: { id: categoryId } });

  if (!category) {
    await safeReply(interaction, { embeds: [errorEmbed("Selected category no longer exists.")], ephemeral: true });
    return;
  }

  // showModal is the first response on this interaction — do NOT
  // defer first. A primary-key Prisma lookup is well under the 3s
  // budget, so we respond directly. If the DB is slow enough that
  // this times out, the safeReply wrapper above would have caught
  // it; in practice the slow path is the modal submit, not this one.
  const modal = buildSubjectModal(category.id, category.name);
  await interaction.showModal(modal);
}

function buildSubjectModal(categoryId: string, categoryName: string): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(`ticket_modal_${categoryId}`)
    .setTitle(`Create Ticket - ${categoryName}`);

  const subjectInput = new TextInputBuilder()
    .setCustomId("ticket_subject")
    .setLabel("Subject")
    .setPlaceholder("Briefly describe your issue or request...")
    .setStyle(TextInputStyle.Short)
    .setRequired(false);

  const descriptionInput = new TextInputBuilder()
    .setCustomId("ticket_description")
    .setLabel("Description")
    .setPlaceholder("Provide more details about your issue...")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(subjectInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput),
  );

  return modal;
}

// ─── Modal Submit ──────────────────────────────────────────

export async function handleTicketModalSubmit(
  interaction: ModalSubmitInteraction,
): Promise<void> {
  if (!interaction.guild) {
    await safeReply(interaction, { embeds: [errorEmbed("This can only be used in a server.")], ephemeral: true });
    return;
  }

  const customId = interaction.customId;
  const categoryId = customId.replace("ticket_modal_", "");

  const category = await prisma.ticketCategory.findUnique({ where: { id: categoryId } });
  if (!category) {
    await safeReply(interaction, { embeds: [errorEmbed("Selected category no longer exists.")], ephemeral: true });
    return;
  }

  const subject = interaction.fields.getTextInputValue("ticket_subject") || null;
  const description = interaction.fields.getTextInputValue("ticket_description") || null;

  await safeDeferReply(interaction, true);

  try {
    const guild = interaction.guild;
    const member = await guild.members.fetch(interaction.user.id);
    const creatorDisplayName = member.nickname || member.user.username;

    const channelName = `${TICKET_PREFIX}${(subject ?? creatorDisplayName).replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase().slice(0, 90)}`;

    const staffRoleId = category.staffRole ?? (await getGuildStaffRole(guild.id));

    let parentCategoryId: string | undefined = undefined;
    if (category.categoryId) {
      try {
        const parentChannel = await guild.channels.fetch(category.categoryId);
        if (parentChannel && parentChannel.type === ChannelType.GuildCategory && parentChannel.guildId === guild.id) {
          parentCategoryId = category.categoryId;
        } else {
          logger.warn(
            `Invalid parent category for ticket creation: guildId=${guild.id}, configuredCategoryId=${category.categoryId}, ` +
            `actualType=${parentChannel?.type ?? "null"}, exists=${!!parentChannel}`
          );
        }
      } catch (error) {
        logger.warn(`Failed to fetch parent category ${category.categoryId}: ${error}`);
      }
    }

    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: parentCategoryId,
      topic: `Ticket created by ${member.user.tag} | Category: ${category.name}${subject ? ` | Subject: ${subject}` : ""}`,
    });

    await denyEveryone(channel);
    await addCreatorToTicket(channel, member);

    if (staffRoleId) {
      await addStaffToTicket(channel, staffRoleId);
    }

    const botMember = guild.members.me;
    if (botMember) {
      await channel.permissionOverwrites.create(botMember, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        ManageChannels: true,
        ManageMessages: true,
        AddReactions: true,
        AttachFiles: true,
      });
    }

    await prisma.ticket.create({
      data: {
        guildId: guild.id,
        channelId: channel.id,
        creatorId: interaction.user.id,
        categoryId: category.id,
        status: "open",
        subject: subject ?? null,
      },
    });

    await createAuditLog(
      guild.id,
      "ticket_create",
      interaction.user.id,
      null,
      null,
      `Created ticket #${channelName} in category "${category.name}"`,
    );

    const openEmbed = await brandedEmbed(guild.id);
    openEmbed.setTitle("Ticket Created");
    openEmbed.setDescription(`Welcome <@${interaction.user.id}>! Support will be with you shortly.`);
    openEmbed.addFields(
      { name: "Category", value: category.name, inline: true },
      { name: "Subject", value: subject ?? "No subject", inline: true },
    );
    if (description) {
      openEmbed.addFields({ name: "Description", value: description });
    }
    openEmbed.setFooter({ text: "Use /ticket close to close this ticket when resolved." });

    await channel.send({ embeds: [openEmbed] });

    await safeEditReply(interaction, {
      embeds: [successEmbed(`Your ticket has been created: <#${channel.id}>.`)],
    });

    const logEmbed = await brandedEmbed(guild.id);
    logEmbed.setTitle("Ticket Created");
    logEmbed.setDescription(`Ticket **${channelName}** created by <@${interaction.user.id}>.`);
    logEmbed.addFields(
      { name: "Category", value: category.name, inline: true },
      { name: "Subject", value: subject ?? "No subject", inline: true },
    );
    if (description) {
      logEmbed.addFields({ name: "Description", value: description });
    }
    await sendToLogChannel(guild, { embeds: [logEmbed] });

    logger.info(`Ticket created: ${channelName} by ${interaction.user.tag}`);
  } catch (error) {
    logger.error(`Failed to create ticket: ${error}`);
    await safeEditReply(interaction, { embeds: [errorEmbed("Failed to create the ticket. Please try again.")] });
  }
}

// ─── Panel helpers (used by both bot and dashboard recreate API) ─

/**
 * Build + send a fresh panel message for an existing TicketPanel row.
 * Used by the dashboard's recreate endpoint and the /ticket panel command
 * (after the row is created).
 *
 * - Fetches the panel and its bound category (if any)
 * - Resolves the brand color from GuildConfig
 * - Uses the same shared builder as the original command
 * - Sends the new message via `client` (Discord client) or `sendViaRest`
 *   for environments that only have a bot token
 *
 * Returns the new messageId on success. Throws on failure.
 */
export interface ResentPanel {
  messageId: string;
  channelId: string;
}

export interface PanelSendClient {
  channels: {
    fetch: (id: string) => Promise<{
      isTextBased: () => boolean;
      send: (payload: any) => Promise<{ id: string }>;
    } | null>;
  };
}

export async function rebuildAndSendPanel(
  panel: {
    id: string;
    guildId: string;
    title: string;
    description: string | null;
    mode: string;
    categoryId: string | null;
  },
  options: {
    targetChannelId: string;
    client?: PanelSendClient;
    botToken?: string;
  },
): Promise<ResentPanel> {
  const channelId = options.targetChannelId;
  if (!channelId) {
    throw new Error("No target channel provided");
  }

  const categories = await prisma.ticketCategory.findMany({
    where: { guildId: panel.guildId },
    select: { id: true, name: true },
  });

  // Determine which categories to expose. For button mode, only the
  // bound category (or a fallback to the first). For dropdown, all.
  const mode: PanelMode = panel.mode === "dropdown" ? "dropdown" : "button";
  let exposedCategories = categories;
  if (mode === "button") {
    const boundId = panel.categoryId;
    if (boundId) {
      const bound = categories.find((c) => c.id === boundId);
      if (bound) exposedCategories = [bound];
    } else if (categories.length > 0) {
      exposedCategories = [categories[0]];
    }
  }

  const color = await getBrandColor(panel.guildId);
  const embed = buildPanelEmbed({
    title: panel.title,
    description: panel.description,
    mode,
    categories: exposedCategories,
    boundCategoryId: panel.categoryId,
    color,
  });
  const rows = buildPanelComponents({
    title: panel.title,
    description: panel.description,
    mode,
    categories: exposedCategories,
    boundCategoryId: panel.categoryId,
    color,
  });

  let sentMessageId: string;
  if (options.client) {
    const channel = await options.client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      throw new Error(`Target channel ${channelId} not found or not text-based`);
    }
    const message = await channel.send({ embeds: [embed], components: rows });
    sentMessageId = message.id;
  } else if (options.botToken) {
    const url = `https://discord.com/api/v10/channels/${channelId}/messages`;
    const body = {
      embeds: [embed.toJSON()],
      components: rows.map((r) => r.toJSON()),
    };
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bot ${options.botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Discord API send failed (${res.status}): ${text}`);
    }
    const json = (await res.json()) as { id: string };
    sentMessageId = json.id;
  } else {
    throw new Error("Either client or botToken must be provided");
  }

  // Update the panel row with the new message id, un-archive
  await prisma.ticketPanel.update({
    where: { id: panel.id },
    data: {
      messageId: sentMessageId,
      channelId,
      archived: false,
    },
  });

  return { messageId: sentMessageId, channelId };
}

/**
 * Used by the dashboard recreate endpoint: takes a panel, finds a usable
 * channel, and rebuilds. Returns the new message info or a structured
 * error suitable for HTTP responses.
 */
export async function recreatePanelViaRest(
  panelId: string,
  guildId: string,
  botToken: string,
): Promise<
  | { ok: true; messageId: string; channelId: string }
  | { ok: false; status: number; error: string; code: string }
> {
  const panel = await prisma.ticketPanel.findUnique({ where: { id: panelId } });
  if (!panel || panel.guildId !== guildId) {
    return { ok: false, status: 404, error: "Panel not found", code: "panel_not_found" };
  }

  // If the panel has a stored channelId, try to use it. Otherwise the
  // admin must pick a new channel via the dashboard (out of scope for
  // this endpoint — it only re-sends into the recorded channel).
  if (!panel.channelId) {
    return {
      ok: false,
      status: 400,
      error: "This panel has no recorded channel. Please set a target channel first.",
      code: "no_channel",
    };
  }

  // Verify the channel still exists by fetching it. Don't assume.
  const channelRes = await fetch(
    `https://discord.com/api/v10/channels/${panel.channelId}`,
    { headers: { Authorization: `Bot ${botToken}` } },
  );
  if (channelRes.status === 404) {
    return {
      ok: false,
      status: 400,
      error: "The recorded channel no longer exists. Please update the panel's target channel first.",
      code: "channel_missing",
    };
  }
  if (!channelRes.ok) {
    return {
      ok: false,
      status: 502,
      error: `Discord API error while checking channel (${channelRes.status})`,
      code: "discord_api_error",
    };
  }

  try {
    const result = await rebuildAndSendPanel(
      {
        id: panel.id,
        guildId: panel.guildId,
        title: panel.title,
        description: panel.description,
        mode: panel.mode,
        categoryId: panel.categoryId,
      },
      { targetChannelId: panel.channelId, botToken },
    );

    await createAuditLog(
      guildId,
      "ticket_panel_recreate",
      "dashboard",
      panel.id,
      null,
      `Recreated ticket panel "${panel.title}" in <#${result.channelId}> (new message ${result.messageId})`,
    );

    return { ok: true, messageId: result.messageId, channelId: result.channelId };
  } catch (error) {
    logger.error(`Failed to recreate ticket panel ${panelId}: ${error}`);
    return {
      ok: false,
      status: 502,
      error: `Failed to send panel message: ${(error as Error).message}`,
      code: "send_failed",
    };
  }
}

export async function archivePanel(panelId: string, guildId: string, archivedBy: string): Promise<boolean> {
  const panel = await prisma.ticketPanel.findUnique({ where: { id: panelId } });
  if (!panel || panel.guildId !== guildId) return false;
  await prisma.ticketPanel.update({
    where: { id: panelId },
    data: { archived: true },
  });
  await createAuditLog(
    guildId,
    "ticket_panel_archive",
    archivedBy,
    panel.id,
    null,
    `Archived ticket panel "${panel.title}"`,
  );
  return true;
}

export async function deletePanelRecord(panelId: string, guildId: string, deletedBy: string): Promise<boolean> {
  const panel = await prisma.ticketPanel.findUnique({ where: { id: panelId } });
  if (!panel || panel.guildId !== guildId) return false;
  await prisma.ticketPanel.delete({ where: { id: panelId } });
  await createAuditLog(
    guildId,
    "ticket_panel_delete",
    deletedBy,
    panelId,
    null,
    `Deleted ticket panel record "${panel.title}" (Discord message left in place)`,
  );
  return true;
}
