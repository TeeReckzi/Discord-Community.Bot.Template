import { NextRequest, NextResponse } from "next/server";
import { verifySession, getSessionCookieName } from "./session";

export async function getSessionFromRequest(req: NextRequest) {
  const cookie = req.cookies.get(getSessionCookieName());
  if (!cookie?.value) return null;
  return verifySession(cookie.value);
}

export async function requireAuth(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return session;
}
