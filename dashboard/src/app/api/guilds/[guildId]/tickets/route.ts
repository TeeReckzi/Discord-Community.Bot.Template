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

    const [categories, activeCount] = await Promise.all([
      prisma.ticketCategory.findMany({
        where: { guildId },
      }),
      prisma.ticket.count({
        where: { guildId, status: "open" },
      }),
    ]);

    return NextResponse.json({ categories, activeCount });
  } catch (error) {
    console.error("Error fetching tickets:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
