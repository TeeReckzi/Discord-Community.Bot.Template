import { Client } from "discord.js";
import { logger } from "./logger";
import { processScheduledAnnouncements } from "../modules/announcements/announcementManager";
import { checkEndedGiveaways } from "../modules/giveaways/giveawayManager";
import { checkEndedPolls } from "../modules/polls/pollManager";
import { recoverState } from "./recovery";

interface HeartbeatConfig {
  id: string;
  callback: () => Promise<void>;
  intervalMs: number;
}

const heartbeats: HeartbeatConfig[] = [];

let heartbeatIntervalId: ReturnType<typeof setInterval> | null = null;

export function registerHeartbeat(
  id: string,
  callback: () => Promise<void>,
  intervalMs: number,
): void {
  if (heartbeats.find((h) => h.id === id)) {
    logger.warn(`Heartbeat ${id} already registered, skipping`);
    return;
  }
  heartbeats.push({ id, callback, intervalMs });
  logger.info(`Registered heartbeat "${id}" (every ${intervalMs}ms)`);
}

function startHeartbeatLoop(): void {
  if (heartbeatIntervalId) {
    clearInterval(heartbeatIntervalId);
  }

  heartbeatIntervalId = setInterval(async () => {
    for (const hb of heartbeats) {
      try {
        await hb.callback();
      } catch (error) {
        logger.error(`Heartbeat "${hb.id}" failed: ${error}`);
      }
    }
  }, 5_000);

  logger.info(`Heartbeat loop started (tick every 5s, ${heartbeats.length} heartbeats)`);
}

export function stopAll(): void {
  if (heartbeatIntervalId) {
    clearInterval(heartbeatIntervalId);
    heartbeatIntervalId = null;
  }
  heartbeats.length = 0;
  logger.info("All heartbeats stopped");
}

export async function startScheduler(client: Client): Promise<void> {
  logger.info("Initializing scheduler...");

  registerHeartbeat(
    "scheduled-announcements",
    () => processScheduledAnnouncements(client),
    30_000,
  );

  registerHeartbeat(
    "ended-giveaways",
    () => checkEndedGiveaways(client),
    15_000,
  );

  registerHeartbeat(
    "ended-polls",
    () => checkEndedPolls(),
    15_000,
  );

  await recoverState(client);

  startHeartbeatLoop();

  logger.info("Scheduler initialized");
}
