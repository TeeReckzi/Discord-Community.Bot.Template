'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface TicketCategory {
  id: string;
  name: string;
  description?: string;
}

interface TicketsData {
  categories: TicketCategory[];
  activeCount: number;
}

export default function TicketsPage() {
  const params = useParams<{ guildId: string }>();
  const [data, setData] = useState<TicketsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/guilds/${params.guildId}/tickets`);
        if (res.status === 401) {
          window.location.href = '/login';
          return;
        }
        if (!res.ok) {
          if (res.status === 404) {
            setData({ categories: [], activeCount: 0 });
            setLoading(false);
            return;
          }
          setError(`Failed to load tickets (${res.status})`);
          setLoading(false);
          return;
        }
        const json: TicketsData = await res.json();
        setData(json);
      } catch {
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.guildId]);

  if (loading) {
    return <p style={{ color: 'var(--text-secondary)' }}>Loading tickets...</p>;
  }

  if (error) {
    return <p style={{ color: 'var(--danger)' }}>{error}</p>;
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem' }}>Ticket Settings</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <a
            href={`/guilds/${params.guildId}/tickets/panels`}
            className="btn btn-secondary"
            style={{ fontSize: '0.85rem' }}
          >
            Manage Panels
          </a>
          <div className="card" style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Active: </span>
            <strong>{data?.activeCount ?? 0}</strong>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Ticket Categories</h2>
        {!data?.categories || data.categories.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>No categories configured yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {data.categories.map((cat) => (
              <div
                key={cat.id}
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div style={{ fontWeight: 500 }}>{cat.name}</div>
                {cat.description && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    {cat.description}
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
