import { NextRequest, NextResponse } from "next/server";
import { getTokenFromCode, getUser } from "@/lib/discord";
import { createSession, getSessionCookieName } from "@/lib/session";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const storedState = req.cookies.get("oauth_state")?.value;

  if (!code || !state || !storedState || state !== storedState) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const token = await getTokenFromCode(code);
  const discordUser = await getUser(token.access_token);

  const expiresAt = Math.floor(Date.now() / 1000) + token.expires_in;

  const sessionToken = await createSession({
    userId: discordUser.id,
    username: discordUser.username,
    avatar: discordUser.avatar,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt,
  });

  const response = NextResponse.redirect(new URL("/guilds", req.url));

  response.cookies.set(getSessionCookieName(), sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  response.cookies.delete("oauth_state");

  return response;
}
