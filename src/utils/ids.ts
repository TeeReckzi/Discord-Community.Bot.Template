export function isSnowflake(id: string): boolean {
  return /^\d{17,20}$/.test(id);
}

export function isValidChannelMention(input: string): boolean {
  const match = input.match(/^<#(\d{17,20})>$/);
  return !!match;
}

export function extractChannelId(input: string): string | null {
  const match = input.match(/(\d{17,20})/);
  return match ? match[1] : null;
}

export function isValidRoleMention(input: string): boolean {
  const match = input.match(/^<@&(\d{17,20})>$/);
  return !!match;
}

export function extractRoleId(input: string): string | null {
  const match = input.match(/(\d{17,20})/);
  return match ? match[1] : null;
}
