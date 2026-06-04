'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface SocialFeed {
  id: string;
  platform: string;
  channel: string;
  feedUrl: string;
  enabled: boolean;
}

const platformColors: Record<string, string> = {
  twitter: '#1DA1F2',
  youtube: '#FF0000',
  twitch: '#9146FF',
  instagram: '#E4405F',
  reddit: '#FF4500',
  github: '#333333',
};

export default function SocialsPage() {
  const params = useParams<{ guildId: string }>();
  const [data, setData] = useState<SocialFeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/guilds/${params.guildId}/socials`);
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
          setError(`Failed to load social feeds (${res.status})`);
          setLoading(false);
          return;
        }
        const json: SocialFeed[] = await res.json();
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
    return <p style={{ color: 'var(--text-secondary)' }}>Loading social feeds...</p>;
  }

  if (error) {
    return <p style={{ color: 'var(--danger)' }}>{error}</p>;
  }

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Social Feeds</h1>

      <div className="card">
        {data.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>No social feeds configured yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {data.map((feed) => (
              <div
                key={feed.id}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '0.25rem 0.5rem',
                      borderRadius: 4,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      color: '#fff',
                      backgroundColor: platformColors[feed.platform?.toLowerCase()] || 'var(--text-secondary)',
                    }}
                  >
                    {feed.platform}
                  </span>
                  <div>
                    <div style={{ fontWeight: 500 }}>{feed.feedUrl}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Channel: {feed.channel}
                    </div>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '0.8rem',
                    padding: '0.25rem 0.5rem',
                    borderRadius: 4,
                    backgroundColor: feed.enabled ? 'rgba(87, 242, 135, 0.15)' : 'rgba(160, 163, 200, 0.15)',
                    color: feed.enabled ? 'var(--success)' : 'var(--text-secondary)',
                  }}
                >
                  {feed.enabled ? 'Active' : 'Disabled'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
