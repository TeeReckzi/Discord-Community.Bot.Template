import { NextRequest, NextResponse } from "next/server";
import { prisma } from "./prisma";
import { getSessionFromRequest } from "./middleware";
import { logDeniedAccess } from "./audit";

const ADMIN_PERMISSION = 1n << 3n;
const MANAGE_GUILD_PERMISSION = 1n << 5n;

export interface SessionUser {
  userId: string;
  username: string;
  avatar: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export type DenyReason =
  | "not_authenticated"
  | "not_in_guild"
  | "no_permission"
  | "staff_check_failed"
  | "discord_api_error";

export interface AllowResult {
  allowed: true;
  user: SessionUser;
}

export interface DenyResult {
  allowed: false;
  reason: DenyReason;
  response: NextResponse;
}

export type PermissionResult = AllowResult | DenyResult;

export interface AuditContext {
  route: string;
  method: string;
}

function hasAdminOrManageGuild(permissions: string | number | bigint): boolean {
  const perms = BigInt(permissions);
  return (
    (perms & ADMIN_PERMISSION) === ADMIN_PERMISSION ||
    (perms & MANAGE_GUILD_PERMISSION) === MANAGE_GUILD_PERMISSION
  );
}

interface DiscordGuild {
  id: string;
  owner: boolean;
  permissions: string;
}

interface DiscordMember {
  roles: string[];
  user?: { id: string };
}

function botTokenOrNull(): string | null {
  const token = process.env.DISCORD_TOKEN;
  return token && token.length > 0 ? token : null;
}

async function fetchGuildViaOAuth(
  accessToken: string,
  guildId: string,
): Promise<DiscordGuild | null> {
  const res = await fetch(
    `https://discord.com/api/v10/users/@me/guilds/${guildId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) return null;
  return (await res.json()) as DiscordGuild;
}

async function fetchMemberViaBot(
  guildId: string,
  userId: string,
): Promise<DiscordMember | null> {
  const botToken = botTokenOrNull();
  if (!botToken) return null;

  const res = await fetch(
    `https://discord.com/api/v10/guilds/${guildId}/members/${userId}`,
    { headers: { Authorization: `Bot ${botToken}` } },
  );
  if (res.status === 404) return null;
  if (!res.ok) return null;
  return (await res.json()) as DiscordMember;
}

/**
 * Server-side permission check. NEVER trusts frontend-supplied data.
 *
 * Allows access if the user is:
 *   1. Authenticated (sessionUser != null)
 *   2. The guild owner, OR
 *   3. Has Administrator or ManageGuild permission in the guild, OR
 *   4. Holds the configured staffRole (GuildConfig.staffRole),
 *      checked via the bot token (server-side only).
 *
 * @param guildId     The guild to check access against.
 * @param sessionUser The verified session, or null if not logged in.
 * @param context     { route, method } for audit logging.
 */
export async function requireGuildManager(
  guildId: string,
  sessionUser: SessionUser | null,
  context: AuditContext,
): Promise<PermissionResult> {
  if (!sessionUser) {
    logDeniedAccess({
      guildId,
      userId: null,
      route: context.route,
      method: context.method,
      reason: "not_authenticated",
    });
    return {
      allowed: false,
      reason: "not_authenticated",
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  let guild: DiscordGuild | null = null;
  try {
    guild = await fetchGuildViaOAuth(sessionUser.accessToken, guildId);
  } catch {
    guild = null;
  }

  if (!guild) {
    logDeniedAccess({
      guildId,
      userId: sessionUser.userId,
      route: context.route,
      method: context.method,
      reason: "not_in_guild",
    });
    return {
      allowed: false,
      reason: "not_in_guild",
      response: NextResponse.json(
        {
          error: "Forbidden",
          reason: "not_in_guild",
          message: "You are not a member of that server.",
        },
        { status: 403 },
      ),
    };
  }

  if (guild.owner || hasAdminOrManageGuild(guild.permissions)) {
    return { allowed: true, user: sessionUser };
  }

  const config = await prisma.guildConfig.findUnique({ where: { guildId } });
  if (config?.staffRole) {
    let member: DiscordMember | null = null;
    try {
      member = await fetchMemberViaBot(guildId, sessionUser.userId);
    } catch {
      member = null;
    }

    if (member && member.roles.includes(config.staffRole)) {
      return { allowed: true, user: sessionUser };
    }

    logDeniedAccess({
      guildId,
      userId: sessionUser.userId,
      route: context.route,
      method: context.method,
      reason: "no_permission",
      detail: "staff_role_mismatch",
    });
    return {
      allowed: false,
      reason: "no_permission",
      response: NextResponse.json(
        {
          error: "Forbidden",
          reason: "no_permission",
          message:
            "You need Administrator, Manage Server, or the configured staff role to manage this bot.",
        },
        { status: 403 },
      ),
    };
  }

  logDeniedAccess({
    guildId,
    userId: sessionUser.userId,
    route: context.route,
    method: context.method,
    reason: "no_permission",
    detail: "missing_admin_or_manage_guild",
  });
  return {
    allowed: false,
    reason: "no_permission",
    response: NextResponse.json(
      {
        error: "Forbidden",
        reason: "no_permission",
        message:
          "You need Administrator, Manage Server, or the configured staff role to manage this bot.",
      },
      { status: 403 },
    ),
  };
}

/**
 * Convenience wrapper for Next.js API route handlers.
 * Pulls the session from the request, then calls requireGuildManager.
 */
export async function checkGuildAccess(
  req: NextRequest,
  guildId: string,
): Promise<PermissionResult> {
  const session = await getSessionFromRequest(req);
  return requireGuildManager(guildId, session, {
    route: req.nextUrl.pathname,
    method: req.method,
  });
}
