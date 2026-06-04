'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface Announcement {
  id: string;
  title: string;
  message: string;
  channel: string;
  createdAt: string;
}

export default function AnnouncementsPage() {
  const params = useParams<{ guildId: string }>();
  const [data, setData] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/guilds/${params.guildId}/announcements`);
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
          setError(`Failed to load announcements (${res.status})`);
          setLoading(false);
          return;
        }
        const json: Announcement[] = await res.json();
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
    return <p style={{ color: 'var(--text-secondary)' }}>Loading announcements...</p>;
  }

  if (error) {
    return <p style={{ color: 'var(--danger)' }}>{error}</p>;
  }

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Announcements</h1>

      <div className="card">
        {data.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>No announcements yet.</p>
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
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{item.title}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                  {item.message}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Channel: {item.channel} &middot; {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
