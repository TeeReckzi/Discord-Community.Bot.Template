import { NextRequest, NextResponse } from "next/server";
import { checkGuildAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/guilds/[guildId]/tickets/panels/[panelId]
 *
 * Body fields (all optional):
 *   - title: string       — update panel title
 *   - description: string — update panel description (null to clear)
 *   - archived: boolean   — set archived state
 *   - channelId: string   — move panel to a new target channel
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { guildId: string; panelId: string } }
) {
  try {
    const auth = await checkGuildAccess(req, params.guildId);
    if (!auth.allowed) return auth.response;

    const { guildId, panelId } = params;
    const body = await req.json().catch(() => ({}));

    const panel = await prisma.ticketPanel.findUnique({ where: { id: panelId } });
    if (!panel || panel.guildId !== guildId) {
      return NextResponse.json(
        { error: "Panel not found", code: "panel_not_found" },
        { status: 404 }
      );
    }

    const data: Record<string, unknown> = {};
    let actionLabel = "ticket_panel_update";

    if (typeof body.title === "string" && body.title.trim().length > 0) {
      data.title = body.title.trim().slice(0, 256);
    }
    if (body.description !== undefined) {
      data.description =
        body.description === null || body.description === ""
          ? null
          : String(body.description).slice(0, 2000);
    }
    if (typeof body.channelId === "string" && body.channelId.length > 0) {
      if (!/^\d{17,20}$/.test(body.channelId)) {
        return NextResponse.json(
          { error: "channelId must be a 17-20 digit snowflake.", code: "invalid_channel" },
          { status: 400 }
        );
      }
      data.channelId = body.channelId;
    }
    if (typeof body.archived === "boolean") {
      data.archived = body.archived;
      actionLabel = body.archived ? "ticket_panel_archive" : "ticket_panel_unarchive";
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update.", code: "no_fields" },
        { status: 400 }
      );
    }

    const updated = await prisma.ticketPanel.update({
      where: { id: panelId },
      data,
    });

    await prisma.auditLog.create({
      data: {
        guildId,
        action: actionLabel,
        moderator: "dashboard",
        target: panelId,
        details: `Updated ticket panel: ${Object.keys(data).join(", ")}`,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating ticket panel:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { guildId: string; panelId: string } }
) {
  try {
    const auth = await checkGuildAccess(req, params.guildId);
    if (!auth.allowed) return auth.response;

    const { guildId, panelId } = params;

    const panel = await prisma.ticketPanel.findUnique({ where: { id: panelId } });
    if (!panel || panel.guildId !== guildId) {
      return NextResponse.json(
        { error: "Panel not found", code: "panel_not_found" },
        { status: 404 }
      );
    }

    await prisma.ticketPanel.delete({ where: { id: panelId } });

    await prisma.auditLog.create({
      data: {
        guildId,
        action: "ticket_panel_delete",
        moderator: "dashboard",
        target: panelId,
        details: `Deleted ticket panel record "${panel.title}" (Discord message left in place)`,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting ticket panel:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
