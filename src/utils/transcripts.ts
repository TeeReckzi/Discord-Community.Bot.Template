import { TextChannel, Message, Collection } from "discord.js";

const FETCH_BATCH_SIZE = 100;
const MAX_MESSAGES = 10_000;

export async function generateTranscript(channel: TextChannel): Promise<string> {
  const allMessages: Message[] = [];
  let lastMessageId: string | undefined;

  while (allMessages.length < MAX_MESSAGES) {
    const fetchOptions: { limit: number; before?: string } = {
      limit: FETCH_BATCH_SIZE,
    };
    if (lastMessageId) {
      fetchOptions.before = lastMessageId;
    }

    const batch: Collection<string, Message> = await channel.messages.fetch(fetchOptions);

    if (batch.size === 0) break;

    allMessages.push(...batch.values());

    if (batch.size < FETCH_BATCH_SIZE) break;

    lastMessageId = batch.lastKey();
  }

  const transcriptLines: string[] = [
    `# Ticket Transcript - ${channel.name}`,
    `# Guild: ${channel.guild.name}`,
    `# Date: ${new Date().toISOString()}`,
    `# Messages: ${allMessages.length}${allMessages.length >= MAX_MESSAGES ? " (truncated)" : ""}`,
    "",
    "---",
    "",
  ];

  const sorted = allMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

  for (const message of sorted) {
    const author = message.author.tag;
    const timestamp = message.createdAt.toISOString();
    const content = message.content || "[no text content]";
    const attachments = message.attachments.size > 0
      ? ` [${message.attachments.size} attachment(s)]`
      : "";

    transcriptLines.push(`**${author}** (${timestamp}):`);
    transcriptLines.push(`${content}${attachments}`);

    if (message.embeds.length > 0) {
      transcriptLines.push(`  [${message.embeds.length} embed(s)]`);
    }
    transcriptLines.push("");
  }

  return transcriptLines.join("\n");
}

export function transcriptToBuffer(text: string): Buffer {
  return Buffer.from(text, "utf8");
}

export function transcriptFilename(channelName: string): string {
  return `transcript-${channelName}-${formatTranscriptDate()}.md`;
}

export function formatTranscriptDate(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}
