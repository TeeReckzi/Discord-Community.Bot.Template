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
