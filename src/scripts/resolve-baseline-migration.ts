/**
 * Resolves baseline migration for databases created via `prisma db push`.
 *
 * Problem: Railway DB was initially created with `prisma db push`, which
 * creates all tables but doesn't create the `_prisma_migrations` table.
 * When `prisma migrate deploy` runs, it tries to CREATE TABLE on existing
 * tables and fails.
 *
 * Solution: Check if `_prisma_migrations` exists. If not, mark the baseline
 * migration as already applied using `prisma migrate resolve --applied`.
 *
 * This script is idempotent and safe to run multiple times.
 */

import { PrismaClient } from "@prisma/client";
import { logger } from "../services/logger";

const BASELINE_MIGRATION = "20260604003738_ticket_panel_and_welcome_leave_unique";

async function main(): Promise<void> {
  const prisma = new PrismaClient();

  try {
    // Check if _prisma_migrations table exists
    const result = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = '_prisma_migrations'
      )::boolean as exists
    `;

    const migrationsTableExists = result[0]?.exists ?? false;

    if (migrationsTableExists) {
      logger.info("_prisma_migrations table exists. Baseline migration already tracked.");
      return;
    }

    logger.info(
      "_prisma_migrations table not found. This database was likely created via 'prisma db push'."
    );
    logger.info("Marking baseline migration as applied...");

    // Create _prisma_migrations table and mark baseline as applied
    // This is equivalent to: prisma migrate resolve --applied <migration-id>
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        "id" TEXT NOT NULL,
        "checksum" TEXT NOT NULL,
        "finished_at" TIMESTAMP(3),
        "migration_name" TEXT NOT NULL,
        "logs" TEXT,
        "rolled_back_at" TIMESTAMP(3),
        "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "applied_steps_count" INTEGER NOT NULL DEFAULT 0,
        CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id")
      )
    `;

    await prisma.$executeRaw`
      INSERT INTO "_prisma_migrations" (
        "id",
        "checksum",
        "finished_at",
        "migration_name",
        "started_at",
        "applied_steps_count"
      ) VALUES (
        gen_random_uuid()::text,
        'baseline-from-db-push',
        NOW(),
        ${BASELINE_MIGRATION},
        NOW(),
        1
      )
    `;

    logger.info(`Baseline migration '${BASELINE_MIGRATION}' marked as applied.`);
    logger.info("Future migrations will now apply correctly via 'prisma migrate deploy'.");
  } catch (error) {
    logger.error("Failed to resolve baseline migration:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
