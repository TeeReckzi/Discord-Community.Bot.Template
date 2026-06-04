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
    const polls = await prisma.poll.findMany({
      where: { guildId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json(polls);
  } catch (error) {
    console.error("Error fetching polls:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
