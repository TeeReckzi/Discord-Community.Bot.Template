/**
 * Audit logger for the dashboard. Emits structured WARN-level records
 * for denied access. Never logs secrets (tokens, cookies, passwords).
 */

export type DenyReason =
  | "not_authenticated"
  | "not_in_guild"
  | "no_permission"
  | "staff_check_failed"
  | "discord_api_error";

export interface DenyAccessEntry {
  guildId: string;
  userId: string | null;
  route: string;
  method: string;
  reason: DenyReason | string;
  detail?: string;
}

export function logDeniedAccess(entry: DenyAccessEntry): void {
  // Structured single-line JSON for easy grep / log shippers.
  // Explicitly whitelisted fields. Never include tokens, cookies, passwords.
  const safe = {
    ts: new Date().toISOString(),
    level: "WARN",
    event: "dashboard_access_denied",
    guildId: entry.guildId,
    userId: entry.userId,
    route: entry.route,
    method: entry.method,
    reason: entry.reason,
    ...(entry.detail ? { detail: entry.detail } : {}),
  };
  console.warn(JSON.stringify(safe));
}

export function logGrantedAccess(entry: {
  guildId: string;
  userId: string;
  route: string;
  method: string;
  via: "owner" | "admin_or_manage_guild" | "staff_role";
}): void {
  const safe = {
    ts: new Date().toISOString(),
    level: "INFO",
    event: "dashboard_access_granted",
    guildId: entry.guildId,
    userId: entry.userId,
    route: entry.route,
    method: entry.method,
    via: entry.via,
  };
  console.info(JSON.stringify(safe));
}
