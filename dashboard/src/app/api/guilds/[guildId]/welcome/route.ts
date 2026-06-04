import { NextRequest, NextResponse } from "next/server";
import { checkGuildAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { guildId: string } }
) {
  try {
    const auth = await checkGuildAccess(req, params.guildId);
    if (!auth.allowed) return auth.response;

    const { guildId } = params;
    const configs = await prisma.welcomeLeaveConfig.findMany({
      where: { guildId },
    });

    return NextResponse.json(configs);
  } catch (error) {
    console.error("Error fetching welcome configs:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { guildId: string } }
) {
  try {
    const auth = await checkGuildAccess(req, params.guildId);
    if (!auth.allowed) return auth.response;

    const { guildId } = params;
    const body = await req.json();

    if (!body.type || !["welcome", "leave"].includes(body.type)) {
      return NextResponse.json({ error: "type must be 'welcome' or 'leave'" }, { status: 400 });
    }

    const config = await prisma.welcomeLeaveConfig.upsert({
      where: { guildId },
      create: {
        guildId,
        type: body.type,
        channelId: body.channelId ?? null,
        message: body.message ?? "Welcome {user} to {server}!",
        embedEnabled: body.embedEnabled ?? false,
        embedColor: body.embedColor ?? "#5865F2",
        embedTitle: body.embedTitle ?? null,
      },
      update: {
        type: body.type,
        ...(body.channelId !== undefined && { channelId: body.channelId }),
        ...(body.message !== undefined && { message: body.message }),
        ...(body.embedEnabled !== undefined && { embedEnabled: body.embedEnabled }),
        ...(body.embedColor !== undefined && { embedColor: body.embedColor }),
        ...(body.embedTitle !== undefined && { embedTitle: body.embedTitle }),
      },
    });

    return NextResponse.json(config, { status: 201 });
  } catch (error) {
    console.error("Error upserting welcome config:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
