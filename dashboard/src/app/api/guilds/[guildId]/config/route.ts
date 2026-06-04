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
    const config = await prisma.guildConfig.findUnique({
      where: { guildId },
    });

    if (!config) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error("Error fetching guild config:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { guildId: string } }
) {
  try {
    const auth = await checkGuildAccess(req, params.guildId);
    if (!auth.allowed) return auth.response;

    const { guildId } = params;
    const body = await req.json();

    const data: Record<string, unknown> = {};
    if (body.logChannel !== undefined) data.logChannel = body.logChannel;
    if (body.brandColor !== undefined) data.brandColor = body.brandColor;
    if (body.staffRole !== undefined) data.staffRole = body.staffRole;

    const config = await prisma.guildConfig.upsert({
      where: { guildId },
      create: { guildId, ...data } as any,
      update: data,
    });

    return NextResponse.json(config);
  } catch (error) {
    console.error("Error updating guild config:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
