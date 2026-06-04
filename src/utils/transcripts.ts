import { TextChannel, Message, Collection } from "discord.js";

const TRANSCRIPT_FETCH_LIMIT = 100;

export async function generateTranscript(channel: TextChannel): Promise<string> {
  const messages: Collection<string, Message> = await channel.messages.fetch({
    limit: TRANSCRIPT_FETCH_LIMIT,
  });

  const transcriptLines: string[] = [
    `# Ticket Transcript - ${channel.name}`,
    `# Guild: ${channel.guild.name}`,
    `# Date: ${new Date().toISOString()}`,
    `# Messages: ${messages.size}`,
    "",
    "---",
    "",
  ];

  const sorted = messages.reverse();

  for (const [, message] of sorted) {
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
