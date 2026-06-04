'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface LogConfig {
  logChannel?: string;
  brandColor?: string;
  staffRole?: string;
}

export default function LogsPage() {
  const params = useParams<{ guildId: string }>();
  const [config, setConfig] = useState<LogConfig>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
          setError(`Failed to load log settings (${res.status})`);
          setLoading(false);
          return;
        }
        const json: LogConfig = await res.json();
        setConfig(json);
      } catch {
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.guildId]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/guilds/${params.guildId}/config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || `Save failed (${res.status})`);
        return;
      }
      setSaved(true);
      setError(null);
    } catch {
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p style={{ color: 'var(--text-secondary)' }}>Loading log settings...</p>;
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem' }}>Log Settings</h1>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {error && (
        <div
          className="card"
          style={{ marginBottom: '1rem', borderColor: 'var(--danger)', color: 'var(--danger)' }}
        >
          {error}
        </div>
      )}

      {saved && (
        <div
          className="card"
          style={{ marginBottom: '1rem', borderColor: 'var(--success)', color: 'var(--success)' }}
        >
          Settings saved successfully!
        </div>
      )}

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div>
          <label htmlFor="logChannel">Log Channel ID</label>
          <input
            id="logChannel"
            className="input"
            placeholder="123456789012345678"
            value={config.logChannel || ''}
            onChange={(e) => setConfig((prev) => ({ ...prev, logChannel: e.target.value }))}
          />
        </div>

        <div>
          <label htmlFor="brandColor">Brand Color</label>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="color"
              value={config.brandColor || '#5865F2'}
              onChange={(e) => setConfig((prev) => ({ ...prev, brandColor: e.target.value }))}
              style={{
                width: 42,
                height: 42,
                borderRadius: 6,
                border: '1px solid rgba(255,255,255,0.1)',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                padding: 2,
              }}
            />
            <input
              id="brandColor"
              className="input"
              placeholder="#5865F2"
              value={config.brandColor || ''}
              onChange={(e) => setConfig((prev) => ({ ...prev, brandColor: e.target.value }))}
            />
          </div>
        </div>

        <div>
          <label htmlFor="staffRole">Staff Role ID</label>
          <input
            id="staffRole"
            className="input"
            placeholder="123456789012345678"
            value={config.staffRole || ''}
            onChange={(e) => setConfig((prev) => ({ ...prev, staffRole: e.target.value }))}
          />
        </div>
      </div>
    </div>
  );
}
