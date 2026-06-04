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

    // Accept either a single-section save ({ type, ... }) or a combined
    // save ({ welcome: {...}, leave: {...} }) from the dashboard form.
    const sections: Array<{ type: string; data: Record<string, unknown> }> = [];
    if (body.type && (body.type === "welcome" || body.type === "leave")) {
      sections.push({ type: body.type, data: body });
    } else {
      if (body.welcome && typeof body.welcome === "object") {
        sections.push({ type: "welcome", data: body.welcome });
      }
      if (body.leave && typeof body.leave === "object") {
        sections.push({ type: "leave", data: body.leave });
      }
    }

    if (sections.length === 0) {
      return NextResponse.json(
        { error: "Body must include type=welcome|leave, or welcome/leave objects." },
        { status: 400 },
      );
    }

    const results = [];
    for (const section of sections) {
      const d = section.data;
      const config = await prisma.welcomeLeaveConfig.upsert({
        where: { guildId_type: { guildId, type: section.type } } as any,
        create: {
          guildId,
          type: section.type,
          channelId: typeof d.channelId === "string" ? d.channelId : null,
          message:
            typeof d.message === "string" && d.message.length > 0
              ? d.message
              : section.type === "welcome"
              ? "Welcome {user} to {server}!"
              : "{user} has left {server}.",
          embedEnabled: !!d.embedEnabled,
          embedColor: typeof d.embedColor === "string" ? d.embedColor : "#5865F2",
          embedTitle: typeof d.embedTitle === "string" ? d.embedTitle : null,
        },
        update: {
          ...(d.channelId !== undefined && { channelId: typeof d.channelId === "string" ? d.channelId : null }),
          ...(d.message !== undefined && { message: String(d.message) }),
          ...(d.embedEnabled !== undefined && { embedEnabled: !!d.embedEnabled }),
          ...(d.embedColor !== undefined && { embedColor: typeof d.embedColor === "string" ? d.embedColor : null }),
          ...(d.embedTitle !== undefined && { embedTitle: typeof d.embedTitle === "string" ? d.embedTitle : null }),
        },
      });
      results.push(config);
    }

    return NextResponse.json(results, { status: 201 });
  } catch (error) {
    console.error("Error upserting welcome config:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
