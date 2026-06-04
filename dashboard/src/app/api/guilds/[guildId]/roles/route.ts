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
    const panels = await prisma.reactionRolePanel.findMany({
      where: { guildId },
      include: { options: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(panels);
  } catch (error) {
    console.error("Error fetching reaction role panels:", error);
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

    if (!body.channelId) {
      return NextResponse.json({ error: "channelId is required" }, { status: 400 });
    }

    const panel = await prisma.reactionRolePanel.create({
      data: {
        guildId,
        channelId: body.channelId,
        title: body.title ?? null,
        style: body.style ?? "button",
        options: {
          create: (body.options ?? []).map((opt: { roleId: string; label: string; emoji?: string; style?: string }) => ({
            roleId: opt.roleId,
            label: opt.label,
            emoji: opt.emoji ?? null,
            style: opt.style ?? "PRIMARY",
          })),
        },
      },
      include: { options: true },
    });

    return NextResponse.json(panel, { status: 201 });
  } catch (error) {
    console.error("Error creating reaction role panel:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
