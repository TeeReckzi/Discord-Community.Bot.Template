import { REST, Routes, SlashCommandBuilder } from "discord.js";
import { logger } from "./services/logger";
import * as dotenv from "dotenv";

dotenv.config();

const commands = [
  // Config
  new SlashCommandBuilder()
    .setName("config")
    .setDescription("View or modify server configuration")
    .addSubcommand((sub) =>
      sub.setName("view").setDescription("View current server configuration"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("set-log-channel")
        .setDescription("Set the logging channel")
        .addChannelOption((opt) =>
          opt.setName("channel").setDescription("The channel to log to").setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("set-brand-color")
        .setDescription("Set the brand color for embeds (hex)")
        .addStringOption((opt) =>
          opt.setName("color").setDescription("Hex color code (e.g. #5865F2)").setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("set-staff-role")
        .setDescription("Set the staff role")
        .addRoleOption((opt) =>
          opt.setName("role").setDescription("The staff role").setRequired(true),
        ),
    ),

  // Tickets
  new SlashCommandBuilder()
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
    ),

  // Welcome
  new SlashCommandBuilder()
    .setName("welcome")
    .setDescription("Configure welcome messages")
    .addSubcommand((sub) =>
      sub
        .setName("setup")
        .setDescription("Set up welcome messages")
        .addChannelOption((opt) =>
          opt.setName("channel").setDescription("Welcome channel").setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("message")
            .setDescription("Welcome message (use {user}, {server}, {memberCount})")
            .setRequired(false),
        )
        .addBooleanOption((opt) =>
          opt
            .setName("embed")
            .setDescription("Use embed mode?")
            .setRequired(false),
        )
        .addStringOption((opt) =>
          opt
            .setName("embed-title")
            .setDescription("Title for the embed")
            .setRequired(false),
        ),
    ),

  // Leave
  new SlashCommandBuilder()
    .setName("leave")
    .setDescription("Configure leave messages")
    .addSubcommand((sub) =>
      sub
        .setName("setup")
        .setDescription("Set up leave messages")
        .addChannelOption((opt) =>
          opt.setName("channel").setDescription("Leave channel").setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("message")
            .setDescription("Leave message (use {user}, {server}, {memberCount})")
            .setRequired(false),
        )
        .addBooleanOption((opt) =>
          opt
            .setName("embed")
            .setDescription("Use embed mode?")
            .setRequired(false),
        )
        .addStringOption((opt) =>
          opt
            .setName("embed-title")
            .setDescription("Title for the embed")
            .setRequired(false),
        ),
    ),

  // Announcements
  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Create announcements")
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Create an announcement")
        .addChannelOption((opt) =>
          opt.setName("channel").setDescription("Channel to announce in").setRequired(true),
        )
        .addStringOption((opt) =>
          opt.setName("content").setDescription("Announcement text").setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("title")
            .setDescription("Embed title (leave empty for plain text)")
            .setRequired(false),
        )
        .addRoleOption((opt) =>
          opt
            .setName("ping-role")
            .setDescription("Role to ping")
            .setRequired(false),
        )
        .addBooleanOption((opt) =>
          opt
            .setName("everyone")
            .setDescription("Ping @everyone?")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("schedule")
        .setDescription("Schedule an announcement")
        .addChannelOption((opt) =>
          opt.setName("channel").setDescription("Channel to announce in").setRequired(true),
        )
        .addStringOption((opt) =>
          opt.setName("content").setDescription("Announcement text").setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("time")
            .setDescription("Time from now (e.g. 1h, 30m, 2d)")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("title")
            .setDescription("Embed title (leave empty for plain text)")
            .setRequired(false),
        ),
    ),

  // Polls
  new SlashCommandBuilder()
    .setName("poll")
    .setDescription("Create polls")
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Create a poll")
        .addStringOption((opt) =>
          opt.setName("question").setDescription("Poll question").setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("options")
            .setDescription('Options separated by commas (e.g. "Yes,No,Maybe")')
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("duration")
            .setDescription("Duration (e.g. 30m, 1h, 1d)")
            .setRequired(false),
        ),
    ),

  // Giveaways
  new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("Manage giveaways")
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Create a giveaway")
        .addStringOption((opt) =>
          opt.setName("prize").setDescription("The prize").setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("duration")
            .setDescription("Duration (e.g. 1h, 2d, 7d)")
            .setRequired(true),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("winners")
            .setDescription("Number of winners")
            .setRequired(false),
        )
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel to host giveaway in")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("end")
        .setDescription("End a giveaway early")
        .addStringOption((opt) =>
          opt
            .setName("message-id")
            .setDescription("The message ID or link of the giveaway")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("reroll")
        .setDescription("Reroll a giveaway winner")
        .addStringOption((opt) =>
          opt
            .setName("message-id")
            .setDescription("The message ID or link of the giveaway")
            .setRequired(true),
        ),
    ),

  // Reaction Roles
  new SlashCommandBuilder()
    .setName("roles")
    .setDescription("Manage reaction role panels")
    .addSubcommand((sub) =>
      sub
        .setName("panel")
        .setDescription("Create a reaction role panel")
        .addStringOption((opt) =>
          opt.setName("title").setDescription("Panel title").setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("style")
            .setDescription("Button or dropdown style")
            .setRequired(true)
            .addChoices(
              { name: "Buttons", value: "button" },
              { name: "Dropdown", value: "dropdown" },
            ),
        )
        .addChannelOption((opt) =>
          opt.setName("channel").setDescription("Channel to send panel to").setRequired(true),
        ),
    ),
].map((cmd) => cmd.toJSON());

async function main(): Promise<void> {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID;
  const guildId = process.env.GUILD_ID;

  if (!token || !clientId) {
    logger.error("DISCORD_TOKEN and CLIENT_ID must be set in .env");
    process.exit(1);
  }

  const rest = new REST({ version: "10" }).setToken(token);

  try {
    logger.info("Registering slash commands...");

    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: commands,
      });
      logger.info(`Registered ${commands.length} guild commands for ${guildId}`);
    } else {
      await rest.put(Routes.applicationCommands(clientId), {
        body: commands,
      });
      logger.info(`Registered ${commands.length} global commands`);
    }
  } catch (error) {
    logger.error(`Failed to register commands: ${error}`);
    process.exit(1);
  }
}

main();
