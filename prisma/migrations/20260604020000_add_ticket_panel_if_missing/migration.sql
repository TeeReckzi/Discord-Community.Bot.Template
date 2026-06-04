-- Create TicketPanel table if it does not exist
CREATE TABLE IF NOT EXISTS "TicketPanel" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketPanel_pkey" PRIMARY KEY ("id")
);

-- Create indexes if they do not exist
CREATE INDEX IF NOT EXISTS "TicketPanel_guildId_idx" ON "TicketPanel"("guildId");
CREATE INDEX IF NOT EXISTS "TicketPanel_categoryId_idx" ON "TicketPanel"("categoryId");

-- Add foreign keys if they do not exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'TicketPanel_guildId_fkey'
      AND table_name = 'TicketPanel'
  ) THEN
    ALTER TABLE "TicketPanel"
    ADD CONSTRAINT "TicketPanel_guildId_fkey"
    FOREIGN KEY ("guildId") REFERENCES "GuildConfig"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'TicketPanel_categoryId_fkey'
      AND table_name = 'TicketPanel'
  ) THEN
    ALTER TABLE "TicketPanel"
    ADD CONSTRAINT "TicketPanel_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "TicketCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
