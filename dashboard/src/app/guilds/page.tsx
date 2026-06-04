'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface Guild {
  id: string;
  name: string;
  icon: string;
  owner: boolean;
  permissions: number;
}

function BannerError() {
  const search = useSearchParams();
  const reason = search.get('error');
  if (!reason) return null;
  const messages: Record<string, string> = {
    not_in_guild: "You're not a member of that server, or you don't have access to it.",
    no_permission:
      "You need Administrator, Manage Server, or the configured staff role to manage this server.",
  };
  const text = messages[reason] ?? `Access denied (${reason}).`;
  return (
    <div
      className="card"
      style={{
        marginBottom: '1.5rem',
        borderColor: 'var(--danger)',
        color: 'var(--danger)',
      }}
    >
      {text}
    </div>
  );
}

export default function GuildsPage() {
  return (
    <Suspense fallback={null}>
      <GuildsPageInner />
    </Suspense>
  );
}

function GuildsPageInner() {
  const router = useRouter();
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const meRes = await fetch('/api/auth/me');
        if (meRes.status === 401) {
          router.replace('/login');
          return;
        }
        if (!meRes.ok) {
          setError('Failed to verify session');
          setLoading(false);
          return;
        }

        const guildsRes = await fetch('/api/guilds');
        if (!guildsRes.ok) {
          setError('Failed to fetch guilds');
          setLoading(false);
          return;
        }

        const data: Guild[] = await guildsRes.json();
        setGuilds(data);
      } catch {
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading guilds...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
        <p style={{ color: 'var(--danger)' }}>{error}</p>
        <a href="/" className="btn btn-secondary">Go Home</a>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem' }}>Select a Server</h1>
        <a href="/api/auth/logout" className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
          Logout
        </a>
      </div>

      <BannerError />

      {guilds.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--text-secondary)' }}>
            No servers found. Make sure the bot is in at least one server and you have Manage Server permission.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '1rem',
          }}
        >
          {guilds.map((guild) => (
            <a
              key={guild.id}
              href={`/guilds/${guild.id}/overview`}
              className="card"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'border-color 0.2s, transform 0.2s',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)';
                (e.currentTarget as HTMLElement).style.transform = 'none';
              }}
            >
              <img
                src={
                  guild.icon
                    ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`
                    : `https://cdn.discordapp.com/embed/avatars/0.png`
                }
                alt={guild.name}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  flexShrink: 0,
                }}
              />
              <div>
                <div style={{ fontWeight: 600 }}>{guild.name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {guild.owner ? 'Owner' : 'Manage Server'}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
