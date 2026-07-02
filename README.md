# Discord Community Bot

A production-ready custom Discord community bot, built with Node.js, TypeScript, discord.js v14, Prisma, and PostgreSQL.

## Features

- **Config System** - Server configuration via `/config` commands (brand color, log channel, staff role)
- **Ticket System** - Multi-category ticket management with transcripts, permission overwrites, and audit logging
- **Welcome/Leave** - Customizable welcome and leave messages with embed support and variable substitution
- **Announcements** - Plain text or embed announcements with role pings and scheduling
- **Polls** - Multi-option polls with timed endings and button-based voting
- **Giveaways** - Prize giveaways with timed entries, random winner selection, and reroll support
- **Reaction Roles** - Button and dropdown-based role assignment panels
- **Social Notifications** - YouTube upload/livestream monitoring framework (TikTok stubbed pending API access)
- **Web Dashboard** - Next.js admin dashboard with Discord OAuth2, guild management, and real-time configuration

## Project Structure

```
src/
├── index.ts                  # Entry point
├── client.ts                 # Discord client setup
├── deploy-commands.ts        # Slash command registration
├── commands/                 # Slash command handlers
│   ├── config/
│   ├── tickets/
│   ├── welcome/
│   ├── announcements/
│   ├── polls/
│   ├── giveaways/
│   └── roles/
├── events/                   # Discord event handlers
│   ├── ready.ts
│   ├── interactionCreate.ts
│   ├── guildMemberAdd.ts
│   └── guildMemberRemove.ts
├── modules/                  # Feature logic
│   ├── tickets/
│   ├── giveaways/
│   ├── polls/
│   ├── announcements/
│   ├── socials/
│   ├── welcome/
│   └── roles/
├── services/                 # Shared services
│   ├── prisma.ts
│   ├── logger.ts
│   ├── scheduler.ts
│   ├── embeds.ts
│   ├── permissions.ts
│   └── interactions.ts
└── utils/                    # Utilities
    ├── duration.ts
    ├── ids.ts
    └── transcripts.ts

dashboard/                    # Next.js admin dashboard
├── src/
│   ├── app/                  # App Router pages & API routes
│   ├── components/           # React components
│   └── lib/                  # Dashboard libraries
└── package.json

prisma/
└── schema.prisma             # Database schema
```

## Prerequisites

- Node.js 18+
- PostgreSQL database
- Discord Bot Token & Application
- Discord OAuth2 Application (for dashboard)

### Discord Bot Setup (in the Developer Portal)

1. Create an application at https://discord.com/developers/applications
2. **Bot tab** → enable the **Server Members Intent** (privileged).
   Required — the bot uses `guildMemberAdd` and `guildMemberRemove`
   events for welcome/leave messages. Without this, those events
   silently never fire.
3. **Bot tab** → copy the bot token into `DISCORD_TOKEN`
4. **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot permissions: at minimum `View Channels`, `Send Messages`,
     `Manage Channels`, `Manage Messages`, `Embed Links`, `Read
     Message History`, `Add Reactions`, `Use Slash Commands`
5. **OAuth2 → Redirects**: add `<dashboard-url>/api/auth/callback`
   (e.g. `http://localhost:3000/api/auth/callback` for dev)
6. Copy **Client ID** and **Client Secret** into the dashboard env.

## Local Development

1. **Clone and install**
   ```bash
   git clone <repo-url>
   cd aethoria-bot
   npm install
   cd dashboard && npm install && cd ..
   ```

2. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

 3. **Generate Prisma client and run migrations**
    ```bash
    npm run prisma:generate
    npm run prisma:migrate:deploy
    ```

 4. **Deploy slash commands**
    ```bash
    npm run commands:deploy
    ```

 5. **Run the bot**
    ```bash
    npm run dev
    ```

 6. **Run the dashboard** (in another terminal)
    ```bash
    cd dashboard && npm run dev
    ```

## Database Migrations

This project uses **Prisma Migrate** for safe, version-controlled database schema changes. Migrations are SQL files stored in `prisma/migrations/` and are applied in order.

### Local Development

**First-time setup:**
```bash
npm run prisma:generate
npm run prisma:migrate:deploy
```

**After pulling schema changes:**
```bash
npm run prisma:migrate:deploy
```

**Creating a new migration:**
```bash
# 1. Edit prisma/schema.prisma
# 2. Generate the migration file (does NOT apply it)
npm run prisma:migrate:create --name describe_your_change
# 3. Review the generated SQL in prisma/migrations/
# 4. Apply it locally
npm run prisma:migrate:deploy
```

### Production Deployment

**Automatic (recommended):**
The `npm run start` script automatically runs `prisma migrate deploy` before starting the bot. This ensures the database schema is always up-to-date on deploy.

**Manual:**
```bash
# Apply pending migrations without starting the bot
npm run prisma:migrate:deploy
```

### Railway Deployment

Railway automatically runs `npm run start` on deploy, which includes `prisma migrate deploy`. No additional configuration needed.

**To manually apply migrations on Railway:**
```bash
railway run npm run prisma:migrate:deploy
```

### Important Notes

- **Never use `prisma db push --accept-data-loss` in production.** This can delete data.
- **Always review migration SQL** before committing. Check `prisma/migrations/*/migration.sql`.
- **Migrations are additive by default.** Destructive changes (dropping columns/tables) require explicit `DROP` statements.
- **Migration history is version-controlled.** Never delete files in `prisma/migrations/` after they've been applied.
- **Rollback is manual.** If a migration fails, you may need to manually revert changes or restore from backup.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start bot in development mode with hot reload |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run start` | Run migrations and start bot in production mode |
| `npm run start:migrate` | Alias for `npm run start` |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate` | Create and apply migrations (dev) |
| `npm run prisma:migrate:deploy` | Apply pending migrations (prod) |
| `npm run prisma:migrate:create` | Create migration file without applying |
| `npm run prisma:studio` | Open Prisma Studio GUI |
| `npm run commands:deploy` | Register slash commands with Discord |
| `npm run commands:sync-permissions` | Sync staff role permissions |

## Deployment to Railway

### Bot Service

1. Create a new Railway project from your Git repository
2. Add a PostgreSQL database
3. Set the following environment variables:
   - `DISCORD_TOKEN` - Your bot token
   - `CLIENT_ID` - Your Discord application ID
   - `DATABASE_URL` - Railway PostgreSQL connection string (auto-provided)
4. Build command: `npm install && npm run prisma:generate && npm run build`
5. Start command: `npm run start` (automatically runs `prisma migrate deploy`)

**Database migrations run automatically on deploy.** The `npm run start` script applies pending migrations before starting the bot.

### Dashboard Service

1. Add a second service pointing to the `dashboard/` directory
2. Set the following environment variables:
   - `DISCORD_CLIENT_ID` - Your Discord OAuth2 client ID
   - `DISCORD_CLIENT_SECRET` - Your Discord OAuth2 client secret
   - `DISCORD_REDIRECT_URI` - Your Railway dashboard URL + `/api/auth/callback`
   - `JWT_SECRET` - A random string for session encryption
   - `DATABASE_URL` - Same PostgreSQL connection string
   - `DISCORD_TOKEN` - Same bot token (for guild verification)
3. Build command: `cd dashboard && npm install && npm run build`
4. Start command: `cd dashboard && npm run start`

## Environment Variables

See `.env.example` for all required and optional variables:

- `DISCORD_TOKEN` - Discord bot token (required)
- `CLIENT_ID` - Discord application ID (required)
- `GUILD_ID` - Development guild ID (for guild-scoped commands)
- `DATABASE_URL` - PostgreSQL connection string (required)
- `YOUTUBE_API_KEY` - YouTube Data API key (optional, for social feeds)
- `DISCORD_CLIENT_ID` - Discord OAuth2 client ID (dashboard)
- `DISCORD_CLIENT_SECRET` - Discord OAuth2 client secret (dashboard)
- `DISCORD_REDIRECT_URI` - OAuth2 callback URL (dashboard)
- `JWT_SECRET` - Session encryption secret (dashboard)

## What Works

- All slash commands (config, tickets, welcome, leave, announce, poll, giveaway, roles)
- Ticket system with full lifecycle (create, close, rename, move, add/remove users, transcripts)
- Welcome/leave messages with embed support
- Announcements with scheduling
- Polls with timed voting
- Giveaways with winner selection and reroll
- Reaction roles (buttons and dropdowns)
- Web dashboard with Discord OAuth2 authentication
- Configuration via web dashboard
- Railway deployment support

## What Still Needs API Keys

- **YouTube notifications**: Requires `YOUTUBE_API_KEY` environment variable and a Google Cloud project with YouTube Data API v3 enabled
- **TikTok notifications**: Requires TikTok Business API access approval and access token (currently stubbed)
- **Discord applications**: Bot token and OAuth2 credentials required for both bot and dashboard

## Commands to Run Locally

```bash
# Install everything
npm install
cd dashboard && npm install && cd ..

# Set up environment
cp .env.example .env
# Edit .env with your Discord token, client ID, and database URL

# Set up database
npm run prisma:generate
npm run prisma:migrate:deploy

# Deploy slash commands
npm run commands:deploy

# Run bot
npm run dev

# Run dashboard (separate terminal)
cd dashboard && npm run dev
```

## Commands to Deploy to Railway

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Add PostgreSQL
railway add postgresql

# Deploy bot
railway up

# Deploy dashboard (add as second service)
# In Railway dashboard: create new service from same repo, set root directory to "dashboard"
```
