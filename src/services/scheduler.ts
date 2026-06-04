import { Client } from "discord.js";
import prisma from "./prisma";
import { logger } from "./logger";
import { processScheduledAnnouncements } from "../modules/announcements/announcementManager";
import { checkEndedGiveaways } from "../modules/giveaways/giveawayManager";
import { checkEndedPolls } from "../modules/polls/pollManager";
import { recoverState } from "./recovery";

type Heartbeat = () => Promise<void>;

const heartbeats: { id: string; callback: Heartbeat }[] = [];

let heartbeatIntervalId: ReturnType<typeof setInterval> | null = null;
let sweeperIntervalId: ReturnType<typeof setInterval> | null = null;
const TICK_MS = 5_000;
const SWEEP_MS = 60_000;
const STALE_LOCK_MINUTES = 15;

export function registerHeartbeat(id: string, callback: Heartbeat): void {
  if (heartbeats.find((h) => h.id === id)) {
    logger.warn(`Heartbeat ${id} already registered, skipping`);
    return;
  }
  heartbeats.push({ id, callback });
  logger.info(`Registered heartbeat "${id}" (every ${TICK_MS}ms)`);
}

function startHeartbeatLoop(): void {
  if (heartbeatIntervalId) clearInterval(heartbeatIntervalId);
  heartbeatIntervalId = setInterval(async () => {
    for (const hb of heartbeats) {
      try {
        await hb.callback();
      } catch (error) {
        logger.error(`Heartbeat "${hb.id}" failed: ${error}`);
      }
    }
  }, TICK_MS);
  logger.info(`Heartbeat loop started (tick every ${TICK_MS}ms, ${heartbeats.length} heartbeats)`);
}

/**
 * Sweep stale optimistic locks. If a previous instance crashed mid-process,
 * the row's `processingStartedAt` is set and no other instance can claim it.
 * Reset locks older than STALE_LOCK_MINUTES so the next tick can retry.
 *
 * Runs once on boot, then every SWEEP_MS.
 */
async function sweepStaleLocks(): Promise<void> {
  const thresholdMinutes = STALE_LOCK_MINUTES;
  try {
    const giveawayRes = await prisma.$executeRaw`
      UPDATE "Giveaway"
      SET "processingStartedAt" = NULL
      WHERE "processingStartedAt" IS NOT NULL
        AND "processingStartedAt" < NOW() - (${thresholdMinutes} || ' minutes')::interval
    `;
    const pollRes = await prisma.$executeRaw`
      UPDATE "Poll"
      SET "processingStartedAt" = NULL
      WHERE "processingStartedAt" IS NOT NULL
        AND "processingStartedAt" < NOW() - (${thresholdMinutes} || ' minutes')::interval
    `;
    const annRes = await prisma.$executeRaw`
      UPDATE "Announcement"
      SET "processingStartedAt" = NULL
      WHERE "processingStartedAt" IS NOT NULL
        AND "processingStartedAt" < NOW() - (${thresholdMinutes} || ' minutes')::interval
    `;
    const total = Number(giveawayRes) + Number(pollRes) + Number(annRes);
    if (total > 0) {
      logger.warn(`Swept ${total} stale processing lock(s) older than ${thresholdMinutes}m`);
    }
  } catch (error) {
    logger.error(`Stale lock sweep failed: ${error}`);
  }
}

function startSweeperLoop(): void {
  if (sweeperIntervalId) clearInterval(sweeperIntervalId);
  sweeperIntervalId = setInterval(() => {
    void sweepStaleLocks();
  }, SWEEP_MS);
  logger.info(`Stale-lock sweeper started (every ${SWEEP_MS / 1000}s, ${STALE_LOCK_MINUTES}m threshold)`);
}

export function stopAll(): void {
  if (heartbeatIntervalId) {
    clearInterval(heartbeatIntervalId);
    heartbeatIntervalId = null;
  }
  if (sweeperIntervalId) {
    clearInterval(sweeperIntervalId);
    sweeperIntervalId = null;
  }
  heartbeats.length = 0;
  logger.info("All heartbeats stopped");
}

export async function startScheduler(client: Client): Promise<void> {
  logger.info("Initializing scheduler...");

  registerHeartbeat("scheduled-announcements", () => processScheduledAnnouncements(client));
  registerHeartbeat("ended-giveaways", () => checkEndedGiveaways(client));
  registerHeartbeat("ended-polls", () => checkEndedPolls());

  await sweepStaleLocks();
  await recoverState(client);

  startHeartbeatLoop();
  startSweeperLoop();

  logger.info("Scheduler initialized");
}
