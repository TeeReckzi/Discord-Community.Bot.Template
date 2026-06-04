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
    const includeArchived = req.nextUrl.searchParams.get("includeArchived") === "true";

    const panels = await prisma.ticketPanel.findMany({
      where: {
        guildId,
        ...(includeArchived ? {} : { archived: false }),
      },
      orderBy: { createdAt: "desc" },
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(panels);
  } catch (error) {
    console.error("Error fetching ticket panels:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
