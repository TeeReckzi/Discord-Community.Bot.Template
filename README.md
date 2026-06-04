# Aethoria's Keep Bot

A production-ready custom Discord community bot for Aethoria's Keep, built with Node.js, TypeScript, discord.js v14, Prisma, and PostgreSQL.

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

3. **Generate Prisma client and push schema**
   ```bash
   npm run prisma:generate
   npm run prisma:push
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

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start bot in development mode with hot reload |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run start` | Start bot in production mode |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate` | Run database migrations |
| `npm run prisma:push` | Push schema to database |
| `npm run commands:deploy` | Register slash commands with Discord |

## Deployment to Railway

### Bot Service

1. Create a new Railway project from your Git repository
2. Add a PostgreSQL database
3. Set the following environment variables:
   - `DISCORD_TOKEN` - Your bot token
   - `CLIENT_ID` - Your Discord application ID
   - `DATABASE_URL` - Railway PostgreSQL connection string (auto-provided)
4. Build command: `npm install && npm run prisma:generate && npm run build`
5. Start command: `npm run start`

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
npx prisma generate
npx prisma db push

# Deploy slash commands
npx tsx src/deploy-commands.ts

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
