# Railway Deployment Instructions

## Pre-Deployment Checklist

1. **Verify environment variables** in Railway dashboard:
   - `DISCORD_TOKEN` (bot token)
   - `DISCORD_CLIENT_ID` (bot application ID)
   - `DISCORD_CLIENT_SECRET` (OAuth2 secret)
   - `DATABASE_URL` (PostgreSQL connection string)
   - `NEXTAUTH_SECRET` (generate with `openssl rand -base64 32`)
   - `NEXTAUTH_URL` (e.g., `https://your-dashboard.up.railway.app`)

2. **Verify the bot is online** and slash commands are registered:
   ```bash
   npm run commands:deploy
   ```

## Deployment Steps

### 1. Push Changes to Git

```bash
git add .
git commit -m "Fix critical production risks: FK constraint, migration baseline, transcript pagination"
git push origin main
```

### 2. Railway Auto-Deploy

Railway will automatically deploy when you push to `main`. The deployment process:

1. **Bot Service**:
   - Runs `npm run build` (compiles TypeScript including `resolve-baseline-migration.js`)
   - Runs `npm start` which executes:
     ```bash
     node dist/scripts/resolve-baseline-migration.js
     prisma migrate deploy
     node dist/index.js
     ```
   - The baseline resolution script checks if `_prisma_migrations` exists
   - If not (database created via `db push`), it marks the baseline as applied
   - Then `prisma migrate deploy` runs safely

2. **Dashboard Service**:
   - Runs `npm run build` (Next.js build with Prisma client generation)
   - Runs `npm start` (Next.js production server)
   - Healthcheck at `/api/health`

### 3. Verify Deployment

**Bot Health**:
```bash
curl https://your-bot-service.up.railway.app/api/health
```

**Dashboard Health**:
```bash
curl https://your-dashboard.up.railway.app/api/health
```

**Check Railway Logs** for:
- `Baseline migration '20260604003738_ticket_panel_and_welcome_leave_unique' marked as applied.`
- `All migrations applied successfully.`
- `Bot is ready!`

### 4. Post-Deployment Verification

**Test TicketPanel Creation** (FK fix):
```
/ticket panel title:Test description:Testing channel:#general
```
This should work even if no `/config` was run before.

**Test Ticket Close** (transcript pagination):
```
/ticket close
```
Check that the transcript file includes all messages (not just last 100).

**Test Dashboard**:
1. Navigate to `https://your-dashboard.up.railway.app`
2. Log in with Discord
3. Verify you can access guild pages
4. Test ticket panel management at `/guilds/[guildId]/tickets/panels`

## Rollback Plan

If deployment fails:

1. **Check Railway logs** for the specific error
2. **If migration fails**:
   - The baseline resolution script is idempotent
   - Manually run in Railway shell: `node dist/scripts/resolve-baseline-migration.js`
   - Then: `npx prisma migrate deploy`
3. **If bot crashes**:
   - Railway will auto-restart
   - Check if port 8080 is available (health server)
4. **If dashboard fails**:
   - Check if Prisma client was generated
   - Verify `DATABASE_URL` is correct

## Known Issues

### Dashboard Dockerfile Context

The current Dockerfile uses `COPY ../prisma ./prisma` which may not work if Railway's build context is the dashboard directory. If this fails:

**Option A**: Set Railway build context to repo root and adjust paths
**Option B**: Copy schema manually before build:
```bash
# In Railway shell or build script
cp ../prisma/schema.prisma ./prisma/schema.prisma
npx prisma generate
npm run build
```

### Migration Lock

If two developers create migrations simultaneously, Prisma will throw a lock error. Solution:
- Coordinate migration creation
- Use `prisma migrate resolve` to manually mark migrations as applied if needed

## Monitoring

**Key Metrics to Watch**:
- Bot uptime (Railway auto-restarts on crash)
- Database connection pool usage
- API rate limits (Discord API)
- Memory usage (transcript pagination can use more memory for large tickets)

**Log Search Patterns**:
- `Swept X stale processing lock(s)` - indicates previous crash
- `TicketPanel X persisted` - successful panel creation
- `Transcript generated` - ticket close success
- `Baseline migration marked as applied` - one-time migration fix

## Future Maintenance

**Creating New Migrations**:
```bash
# Local development
npx prisma migrate dev --create-only
git add prisma/migrations/
git commit -m "Add migration: <description>"
git push
```

Railway will automatically apply new migrations on next deploy via `prisma migrate deploy`.

**Manual Migration Apply** (if needed):
```bash
# In Railway shell
npx prisma migrate deploy
```
