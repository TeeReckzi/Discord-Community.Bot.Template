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
} from "discord.js";

import prisma from "../../services/prisma";
import { logger } from "../../services/logger";
import { generateTranscript } from "../../utils/transcripts";
import { safeDeferReply, safeDeferUpdate, safeReply, safeEditReply, safeFollowUp } from "../../services/interactions";
import { brandedEmbed, successEmbed, errorEmbed } from "../../services/embeds";

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

async function getTicket(channelId: string) {
  try {
    return await prisma.ticket.findUnique({ where: { channelId } });
  } catch {
    return null;
  }
}

async function sendToLogChannel(
  guild: Guild,
  embed: { embeds: any[] },
): Promise<void> {
  try {
    const config = await prisma.guildConfig.findUnique({ where: { guildId: guild.id } });
    if (!config?.logChannel) return;
    const logChannel = guild.channels.cache.get(config.logChannel) as TextChannel | undefined;
    if (logChannel) {
      await logChannel.send(embed);
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
  const description = interaction.options.getString("description") ?? "Click the button below to create a ticket.";

  const embed = await brandedEmbed(interaction.guild.id);
  embed.setTitle(title);
  embed.setDescription(description);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_create")
      .setLabel("Create Ticket")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("🎫"),
  );

  await safeReply(interaction, { embeds: [embed], components: [row] });
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
  const ticket = await getTicket(channel.id);

  if (!ticket) {
    await safeReply(interaction, { embeds: [errorEmbed("This channel is not an open ticket.")], ephemeral: true });
    return;
  }

  await safeDeferReply(interaction);

  try {
    const transcript = await generateTranscript(channel);

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
    await sendToLogChannel(interaction.guild, { embeds: [logEmbed] });

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
  const ticket = await getTicket(channel.id);

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
  const ticket = await getTicket(channel.id);

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
  const ticket = await getTicket(channel.id);

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
      ticket.creatorId,
      null,
      `Added <@${member.id}> to ticket`,
    );

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
  const ticket = await getTicket(channel.id);

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
      ticket.creatorId,
      null,
      `Removed <@${targetUser.id}> from ticket`,
    );

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

    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: category.categoryId ?? undefined,
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
