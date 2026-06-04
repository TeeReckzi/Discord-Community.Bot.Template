'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface ReactionRole {
  id: string;
  channel: string;
  message: string;
  role: string;
  emoji: string;
}

export default function RolesPage() {
  const params = useParams<{ guildId: string }>();
  const [data, setData] = useState<ReactionRole[]>([]);
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
        const json: ReactionRole[] = await res.json();
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
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Emoji</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Channel</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Message ID</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Role ID</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <td style={{ padding: '0.75rem 0.5rem', fontSize: '1.2rem' }}>{item.emoji}</td>
                  <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)' }}>{item.channel}</td>
                  <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '0.8rem' }}>{item.message}</td>
                  <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '0.8rem' }}>{item.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
