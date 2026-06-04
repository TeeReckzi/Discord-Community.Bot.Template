import { NextResponse } from "next/server";
import crypto from "crypto";
import { getOAuthURL } from "@/lib/discord";

export async function GET() {
  const state = crypto.randomBytes(32).toString("hex");
  const redirectUrl = getOAuthURL(state);

  const response = NextResponse.redirect(redirectUrl);

  response.cookies.set("oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return response;
}
