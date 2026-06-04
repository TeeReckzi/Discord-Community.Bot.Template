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
    const giveaways = await prisma.giveaway.findMany({
      where: { guildId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json(giveaways);
  } catch (error) {
    console.error("Error fetching giveaways:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
