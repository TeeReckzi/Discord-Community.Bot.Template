import Sidebar from '@/components/Sidebar';

export default function GuildLayout({
  params,
  children,
}: {
  params: { guildId: string };
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar guildId={params.guildId} guildName={params.guildId} />
      <main style={{ flex: 1, padding: '2rem', overflow: 'auto' }}>{children}</main>
    </div>
  );
}
