'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface PollOption {
  label: string;
  votes: number;
}

interface Poll {
  id: string;
  question: string;
  channel: string;
  options: PollOption[];
  active: boolean;
  endsAt: string;
}

export default function PollsPage() {
  const params = useParams<{ guildId: string }>();
  const [data, setData] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/guilds/${params.guildId}/polls`);
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
          setError(`Failed to load polls (${res.status})`);
          setLoading(false);
          return;
        }
        const json: Poll[] = await res.json();
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
    return <p style={{ color: 'var(--text-secondary)' }}>Loading polls...</p>;
  }

  if (error) {
    return <p style={{ color: 'var(--danger)' }}>{error}</p>;
  }

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Polls</h1>

      <div className="card">
        {data.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>No polls yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {data.map((poll) => (
              <div
                key={poll.id}
                style={{
                  padding: '1rem',
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{poll.question}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Channel: {poll.channel}
                      {poll.endsAt ? ` \u00B7 Ends: ${new Date(poll.endsAt).toLocaleDateString()}` : ''}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: '0.8rem',
                      padding: '0.25rem 0.5rem',
                      borderRadius: 4,
                      backgroundColor: poll.active ? 'rgba(87, 242, 135, 0.15)' : 'rgba(160, 163, 200, 0.15)',
                      color: poll.active ? 'var(--success)' : 'var(--text-secondary)',
                    }}
                  >
                    {poll.active ? 'Active' : 'Closed'}
                  </span>
                </div>
                {poll.options && poll.options.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                    {poll.options.map((opt, idx) => (
                      <div key={idx} style={{ fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{opt.label}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{opt.votes} votes</span>
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
