import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/middleware";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { guildId: string } }
) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { guildId } = params;
    const configs = await prisma.socialFeedConfig.findMany({
      where: { guildId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(configs);
  } catch (error) {
    console.error("Error fetching social feed configs:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { guildId: string } }
) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { guildId } = params;
    const body = await req.json();

    if (!body.platform || !body.channelId_or_username || !body.channelId) {
      return NextResponse.json(
        { error: "platform, channelId_or_username, and channelId are required" },
        { status: 400 }
      );
    }

    const config = await prisma.socialFeedConfig.upsert({
      where: {
        guildId_platform_channelId_or_username: {
          guildId,
          platform: body.platform,
          channelId_or_username: body.channelId_or_username,
        },
      },
      create: {
        guildId,
        channelId: body.channelId,
        platform: body.platform,
        channelId_or_username: body.channelId_or_username,
      },
      update: {
        channelId: body.channelId,
      },
    });

    return NextResponse.json(config, { status: 201 });
  } catch (error) {
    console.error("Error upserting social feed config:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
