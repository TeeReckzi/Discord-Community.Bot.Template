'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface GuildConfig {
  logChannel?: string;
  brandColor?: string;
  staffRole?: string;
}

export default function OverviewPage() {
  const params = useParams<{ guildId: string }>();
  const [config, setConfig] = useState<GuildConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/guilds/${params.guildId}/config`);
        if (res.status === 401) {
          window.location.href = '/login';
          return;
        }
        if (!res.ok) {
          if (res.status === 404) {
            setConfig({});
            setLoading(false);
            return;
          }
          setError(`Failed to load config (${res.status})`);
          setLoading(false);
          return;
        }
        const data: GuildConfig = await res.json();
        setConfig(data);
      } catch {
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.guildId]);

  if (loading) {
    return <p style={{ color: 'var(--text-secondary)' }}>Loading overview...</p>;
  }

  if (error) {
    return <p style={{ color: 'var(--danger)' }}>{error}</p>;
  }

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Server Overview</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div className="card">
          <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Configuration</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.75rem 1.5rem', fontSize: '0.9rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Log Channel</span>
            <span>{config?.logChannel ? `${config.logChannel}` : <span style={{ color: 'var(--text-secondary)' }}>Not set</span>}</span>

            <span style={{ color: 'var(--text-secondary)' }}>Brand Color</span>
            <span>
              {config?.brandColor ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 16,
                      height: 16,
                      borderRadius: 4,
                      backgroundColor: config.brandColor,
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                  />
                  {config.brandColor}
                </span>
              ) : (
                <span style={{ color: 'var(--text-secondary)' }}>Not set</span>
              )}
            </span>

            <span style={{ color: 'var(--text-secondary)' }}>Staff Role</span>
            <span>{config?.staffRole ? `${config.staffRole}` : <span style={{ color: 'var(--text-secondary)' }}>Not set</span>}</span>
          </div>
        </div>

        <div className="card">
          <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Quick Stats</h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '1rem',
            }}
          >
            <div style={{ textAlign: 'center', padding: '1rem' }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent)' }}>0</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Active Tickets</div>
            </div>
            <div style={{ textAlign: 'center', padding: '1rem' }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--success)' }}>0</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Active Giveaways</div>
            </div>
            <div style={{ textAlign: 'center', padding: '1rem' }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--warning)' }}>0</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Active Polls</div>
            </div>
            <div style={{ textAlign: 'center', padding: '1rem' }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-secondary)' }}>0</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Reaction Roles</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
