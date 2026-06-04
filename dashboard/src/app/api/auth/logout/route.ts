import { NextResponse } from "next/server";
import { getSessionCookieName } from "@/lib/session";

export async function GET() {
  const response = NextResponse.redirect(new URL("/"));

  response.cookies.delete(getSessionCookieName());

  return response;
}
