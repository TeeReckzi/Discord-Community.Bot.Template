'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface ReactionRoleOption {
  id: string;
  roleId: string;
  label: string;
  emoji: string | null;
  style: string;
}

interface ReactionRolePanel {
  id: string;
  channelId: string;
  messageId: string | null;
  title: string | null;
  style: string;
  options: ReactionRoleOption[];
}

export default function RolesPage() {
  const params = useParams<{ guildId: string }>();
  const [data, setData] = useState<ReactionRolePanel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/guilds/${params.guildId}/roles`);
        if (res.status === 401) {
          window.location.href = '/login';
          return;
        }
        if (!res.ok) {
          if (res.status === 404) {
            setData([]);
            setLoading(false);
            return;
          }
          setError(`Failed to load reaction roles (${res.status})`);
          setLoading(false);
          return;
        }
        const json: ReactionRolePanel[] = await res.json();
        setData(Array.isArray(json) ? json : []);
      } catch {
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.guildId]);

  if (loading) {
    return <p style={{ color: 'var(--text-secondary)' }}>Loading reaction roles...</p>;
  }

  if (error) {
    return <p style={{ color: 'var(--danger)' }}>{error}</p>;
  }

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Reaction Roles</h1>

      <div className="card">
        {data.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>No reaction roles configured yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {data.map((panel) => (
              <div
                key={panel.id}
                style={{
                  padding: '1rem',
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                  {panel.title ?? "(untitled panel)"}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                  Channel: {panel.channelId} &middot; Style: {panel.style}
                </div>
                {panel.options && panel.options.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {panel.options.map((opt) => (
                      <div
                        key={opt.id}
                        style={{ fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between' }}
                      >
                        <span>
                          {opt.emoji ? `${opt.emoji} ` : ""}
                          {opt.label}
                        </span>
                        <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                          {opt.roleId}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
