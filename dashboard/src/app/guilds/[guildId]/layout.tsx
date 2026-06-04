import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Sidebar from "@/components/Sidebar";
import { verifySession, getSessionCookieName } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { logDeniedAccess } from "@/lib/audit";

const ADMIN_PERMISSION = 1n << 3n;
const MANAGE_GUILD_PERMISSION = 1n << 5n;

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
}

async function fetchGuildViaOAuth(
  accessToken: string,
  guildId: string,
): Promise<DiscordGuild | null> {
  try {
    const res = await fetch(
      `https://discord.com/api/v10/users/@me/guilds/${guildId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) return null;
    return (await res.json()) as DiscordGuild;
  } catch {
    return null;
  }
}

async function fetchMemberViaBot(
  guildId: string,
  userId: string,
): Promise<DiscordMember | null> {
  const botToken = process.env.DISCORD_TOKEN;
  if (!botToken) return null;
  try {
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${userId}`,
      { headers: { Authorization: `Bot ${botToken}` } },
    );
    if (!res.ok) return null;
    return (await res.json()) as DiscordMember;
  } catch {
    return null;
  }
}

export default async function GuildLayout({
  params,
  children,
}: {
  params: { guildId: string };
  children: React.ReactNode;
}) {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get(getSessionCookieName());
  const session = sessionCookie ? await verifySession(sessionCookie.value) : null;

  if (!session) {
    logDeniedAccess({
      guildId: params.guildId,
      userId: null,
      route: `/guilds/${params.guildId}/layout`,
      method: "GET",
      reason: "not_authenticated",
    });
    redirect("/login");
  }

  const guild = await fetchGuildViaOAuth(session.accessToken, params.guildId);
  if (!guild) {
    logDeniedAccess({
      guildId: params.guildId,
      userId: session.userId,
      route: `/guilds/${params.guildId}/layout`,
      method: "GET",
      reason: "not_in_guild",
    });
    redirect("/guilds?error=not_in_guild");
  }

  let allowed = guild.owner || hasAdminOrManageGuild(guild.permissions);

  if (!allowed) {
    const config = await prisma.guildConfig.findUnique({
      where: { guildId: params.guildId },
    });
    if (config?.staffRole) {
      const member = await fetchMemberViaBot(params.guildId, session.userId);
      if (member && member.roles.includes(config.staffRole)) {
        allowed = true;
      }
    }
  }

  if (!allowed) {
    logDeniedAccess({
      guildId: params.guildId,
      userId: session.userId,
      route: `/guilds/${params.guildId}/layout`,
      method: "GET",
      reason: "no_permission",
      detail: "layout_gate",
    });
    redirect("/guilds?error=no_permission");
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar guildId={params.guildId} guildName={params.guildId} />
      <main style={{ flex: 1, padding: "2rem", overflow: "auto" }}>{children}</main>
    </div>
  );
}
