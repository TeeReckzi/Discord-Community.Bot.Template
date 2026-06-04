-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "GuildConfig" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "logChannel" TEXT,
    "brandColor" TEXT DEFAULT '#5865F2',
    "staffRole" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuildConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketCategory" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT,
    "staffRole" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketPanel" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'button',
    "categoryId" TEXT,
    "createdById" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketPanel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "categoryId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "subject" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "transcript" TEXT,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Giveaway" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT,
    "prize" TEXT NOT NULL,
    "winnerCount" INTEGER NOT NULL DEFAULT 1,
    "duration" TEXT NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "ended" BOOLEAN NOT NULL DEFAULT false,
    "hostedBy" TEXT NOT NULL,
    "winnerIds" TEXT,
    "processingStartedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Giveaway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiveawayEntry" (
    "id" TEXT NOT NULL,
    "giveawayId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiveawayEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Poll" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT,
    "question" TEXT NOT NULL,
    "options" TEXT NOT NULL,
    "endsAt" TIMESTAMP(3),
    "ended" BOOLEAN NOT NULL DEFAULT false,
    "processingStartedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Poll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollVote" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "option" INTEGER NOT NULL,

    CONSTRAINT "PollVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT,
    "content" TEXT NOT NULL,
    "embed" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "published" BOOLEAN NOT NULL DEFAULT false,
    "processingStartedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WelcomeLeaveConfig" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "channelId" TEXT,
    "message" TEXT NOT NULL DEFAULT 'Welcome {user} to {server}!',
    "embedEnabled" BOOLEAN NOT NULL DEFAULT false,
    "embedColor" TEXT DEFAULT '#5865F2',
    "embedTitle" TEXT,

    CONSTRAINT "WelcomeLeaveConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReactionRolePanel" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT,
    "title" TEXT,
    "style" TEXT NOT NULL DEFAULT 'button',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReactionRolePanel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReactionRoleOption" (
    "id" TEXT NOT NULL,
    "panelId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "emoji" TEXT,
    "style" TEXT NOT NULL DEFAULT 'PRIMARY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReactionRoleOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialFeedConfig" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "channelId_or_username" TEXT NOT NULL,
    "lastChecked" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialFeedConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "moderator" TEXT NOT NULL,
    "target" TEXT,
    "reason" TEXT,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuildConfig_guildId_key" ON "GuildConfig"("guildId");

-- CreateIndex
CREATE INDEX "TicketPanel_guildId_idx" ON "TicketPanel"("guildId");

-- CreateIndex
CREATE INDEX "TicketPanel_categoryId_idx" ON "TicketPanel"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_channelId_key" ON "Ticket"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "GiveawayEntry_giveawayId_userId_key" ON "GiveawayEntry"("giveawayId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "PollVote_pollId_userId_key" ON "PollVote"("pollId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "WelcomeLeaveConfig_guildId_type_key" ON "WelcomeLeaveConfig"("guildId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "SocialFeedConfig_guildId_platform_channelId_or_username_key" ON "SocialFeedConfig"("guildId", "platform", "channelId_or_username");

-- AddForeignKey
ALTER TABLE "TicketPanel" ADD CONSTRAINT "TicketPanel_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildConfig"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketPanel" ADD CONSTRAINT "TicketPanel_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TicketCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TicketCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiveawayEntry" ADD CONSTRAINT "GiveawayEntry_giveawayId_fkey" FOREIGN KEY ("giveawayId") REFERENCES "Giveaway"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReactionRoleOption" ADD CONSTRAINT "ReactionRoleOption_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "ReactionRolePanel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

