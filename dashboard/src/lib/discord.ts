const API_BASE = "https://discord.com/api/v10";

interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export function getOAuthURL(state: string): string {
  const clientId = process.env.DISCORD_CLIENT_ID!;
  const redirectUri = process.env.DISCORD_REDIRECT_URI!;
  const scopes = ["identify", "guilds"].join(" ");

  const url = new URL(`${API_BASE}/oauth2/authorize`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopes);
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "consent");
  return url.toString();
}

export async function getTokenFromCode(code: string): Promise<DiscordTokenResponse> {
  const clientId = process.env.DISCORD_CLIENT_ID!;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET!;
  const redirectUri = process.env.DISCORD_REDIRECT_URI!;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  const res = await fetch(`${API_BASE}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status}`);
  }

  return res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<DiscordTokenResponse> {
  const clientId = process.env.DISCORD_CLIENT_ID!;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET!;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const res = await fetch(`${API_BASE}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    throw new Error(`Token refresh failed: ${res.status}`);
  }

  return res.json();
}

export async function getUser(accessToken: string): Promise<{ id: string; username: string; avatar: string; discriminator: string }> {
  const res = await fetch(`${API_BASE}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch user: ${res.status}`);
  }

  return res.json();
}

export async function getUserGuilds(accessToken: string): Promise<Array<{ id: string; name: string; icon: string; owner: boolean; permissions: number }>> {
  const res = await fetch(`${API_BASE}/users/@me/guilds`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch guilds: ${res.status}`);
  }

  return res.json();
}

export async function getBotGuilds(botToken: string): Promise<Array<{ id: string; name: string }>> {
  const res = await fetch(`${API_BASE}/users/@me/guilds`, {
    headers: { Authorization: `Bot ${botToken}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch bot guilds: ${res.status}`);
  }

  return res.json();
}

export function hasManageServer(permissions: number): boolean {
  const ADMINISTRATOR = BigInt(1) << BigInt(3);
  const MANAGE_GUILD = BigInt(1) << BigInt(5);
  const perms = BigInt(permissions);
  return (perms & ADMINISTRATOR) === ADMINISTRATOR || (perms & MANAGE_GUILD) === MANAGE_GUILD;
}
