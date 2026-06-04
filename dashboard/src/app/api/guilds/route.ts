import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/middleware";
import { getUserGuilds, getBotGuilds, hasManageServer } from "@/lib/discord";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userGuilds = await getUserGuilds(session.accessToken);
    const manageable = userGuilds.filter((g) => hasManageServer(g.permissions));

    const botToken = process.env.DISCORD_TOKEN;
    if (!botToken) {
      return NextResponse.json({ error: "Bot token not configured" }, { status: 500 });
    }

    const botGuilds = await getBotGuilds(botToken);
    const botGuildIds = new Set(botGuilds.map((g) => g.id));

    const guilds = manageable.filter((g) => botGuildIds.has(g.id));

    return NextResponse.json(
      guilds.map((g) => ({
        id: g.id,
        name: g.name,
        icon: g.icon,
        owner: g.owner,
        permissions: g.permissions,
      }))
    );
  } catch (error) {
    console.error("Error fetching guilds:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
