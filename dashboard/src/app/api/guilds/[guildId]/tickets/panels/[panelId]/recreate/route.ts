import { NextRequest, NextResponse } from "next/server";
import { checkGuildAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

/**
 * Send a panel message via the bot token. Mirrors the shared panel
 * builder in src/modules/tickets/panelBuilder.ts — the bot command
 * and this endpoint must stay in sync. If the builder changes, update
 * the corresponding shape here.
 */
async function sendPanelMessage(
  botToken: string,
  channelId: string,
  payload: {
    title: string;
    description: string | null;
    mode: "button" | "dropdown";
    categories: Array<{ id: string; name: string }>;
  }
): Promise<string> {
  const embed: Record<string, unknown> = {
    title: payload.title,
    description: payload.description ?? "Click the button below to create a ticket.",
    color: 0x5865f2,
    footer: { text: "Aethoria's Keep" },
    timestamp: new Date().toISOString(),
  };

  let components: Array<{
    type: 1;
    components: Array<Record<string, unknown>>;
  }> = [];

  if (payload.mode === "button") {
    components = [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 1,
            label: "Create Ticket",
            emoji: { name: "🎫" },
            custom_id: "ticket_create",
          },
        ],
      },
    ];
  } else {
    components = [
      {
        type: 1,
        components: [
          {
            type: 3,
            custom_id: "ticket_panel_select",
            placeholder: "Select a ticket category",
            options: payload.categories.map((c) => ({
              label: c.name,
              description: `Create a ticket in ${c.name}`,
              value: c.id,
              emoji: { name: "📂" },
            })),
          },
        ],
      },
    ];
  }

  const res = await fetch(
    `https://discord.com/api/v10/channels/${channelId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ embeds: [embed], components }),
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Discord API send failed (${res.status}): ${text}`);
  }
  const json = (await res.json()) as { id: string };
  return json.id;
}

export async function POST(
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

    if (!panel.channelId) {
      return NextResponse.json(
        {
          error: "This panel has no recorded channel. Please set a target channel first.",
          code: "no_channel",
        },
        { status: 400 }
      );
    }

    const botToken = process.env.DISCORD_TOKEN;
    if (!botToken) {
      return NextResponse.json(
        { error: "Bot token not configured on dashboard server." },
        { status: 500 }
      );
    }

    // Verify the channel still exists. Don't assume the old one is there.
    const channelRes = await fetch(
      `https://discord.com/api/v10/channels/${panel.channelId}`,
      { headers: { Authorization: `Bot ${botToken}` } }
    );
    if (channelRes.status === 404) {
      return NextResponse.json(
        {
          error: "The recorded channel no longer exists. Please update the panel's target channel first.",
          code: "channel_missing",
        },
        { status: 400 }
      );
    }
    if (!channelRes.ok) {
      return NextResponse.json(
        {
          error: `Discord API error while checking channel (${channelRes.status})`,
          code: "discord_api_error",
        },
        { status: 502 }
      );
    }

    // Resolve categories for the embed / components
    const categories = await prisma.ticketCategory.findMany({
      where: { guildId },
      select: { id: true, name: true },
    });
    const mode = panel.mode === "dropdown" ? "dropdown" : "button";
    let exposed: Array<{ id: string; name: string }> = categories;
    if (mode === "button" && panel.categoryId) {
      const bound = categories.find((c: { id: string; name: string }) => c.id === panel.categoryId);
      if (bound) exposed = [bound];
    }

    let newMessageId: string;
    try {
      newMessageId = await sendPanelMessage(botToken, panel.channelId, {
        title: panel.title,
        description: panel.description,
        mode,
        categories: exposed,
      });
    } catch (error) {
      console.error("Failed to send panel message:", error);
      return NextResponse.json(
        {
          error: `Failed to send panel message: ${(error as Error).message}`,
          code: "send_failed",
        },
        { status: 502 }
      );
    }

    await prisma.ticketPanel.update({
      where: { id: panel.id },
      data: {
        messageId: newMessageId,
        channelId: panel.channelId,
        archived: false,
      },
    });

    await prisma.auditLog.create({
      data: {
        guildId,
        action: "ticket_panel_recreate",
        moderator: "dashboard",
        target: panel.id,
        details: `Recreated ticket panel "${panel.title}" in <#${panel.channelId}> (new message ${newMessageId})`,
      },
    });

    return NextResponse.json({
      ok: true,
      messageId: newMessageId,
      channelId: panel.channelId,
    });
  } catch (error) {
    console.error("Error recreating ticket panel:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
