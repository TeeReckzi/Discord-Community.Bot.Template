'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface Giveaway {
  id: string;
  prize: string;
  channel: string;
  winners: number;
  endsAt: string;
  active: boolean;
}

export default function GiveawaysPage() {
  const params = useParams<{ guildId: string }>();
  const [data, setData] = useState<Giveaway[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/guilds/${params.guildId}/giveaways`);
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
          setError(`Failed to load giveaways (${res.status})`);
          setLoading(false);
          return;
        }
        const json: Giveaway[] = await res.json();
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
    return <p style={{ color: 'var(--text-secondary)' }}>Loading giveaways...</p>;
  }

  if (error) {
    return <p style={{ color: 'var(--danger)' }}>{error}</p>;
  }

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Giveaways</h1>

      <div className="card">
        {data.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>No giveaways yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {data.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: '1rem',
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{item.prize}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Channel: {item.channel} &middot; {item.winners} winner{item.winners !== 1 ? 's' : ''}
                    {item.endsAt ? ` \u00B7 Ends: ${new Date(item.endsAt).toLocaleDateString()}` : ''}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '0.8rem',
                    padding: '0.25rem 0.5rem',
                    borderRadius: 4,
                    backgroundColor: item.active ? 'rgba(87, 242, 135, 0.15)' : 'rgba(160, 163, 200, 0.15)',
                    color: item.active ? 'var(--success)' : 'var(--text-secondary)',
                  }}
                >
                  {item.active ? 'Active' : 'Ended'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
