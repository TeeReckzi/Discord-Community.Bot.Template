'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface WelcomeConfig {
  welcome: {
    enabled: boolean;
    channel: string;
    message: string;
    embed: boolean;
    embedTitle: string;
  };
  leave: {
    enabled: boolean;
    channel: string;
    message: string;
    embed: boolean;
    embedTitle: string;
  };
}

const defaultConfig: WelcomeConfig = {
  welcome: { enabled: false, channel: '', message: '', embed: false, embedTitle: '' },
  leave: { enabled: false, channel: '', message: '', embed: false, embedTitle: '' },
};

export default function WelcomePage() {
  const params = useParams<{ guildId: string }>();
  const [config, setConfig] = useState<WelcomeConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/guilds/${params.guildId}/welcome`);
        if (res.status === 401) {
          window.location.href = '/login';
          return;
        }
        if (!res.ok) {
          if (res.status === 404) {
            setConfig(defaultConfig);
            setLoading(false);
            return;
          }
          setError(`Failed to load welcome settings (${res.status})`);
          setLoading(false);
          return;
        }
        const json: WelcomeConfig = await res.json();
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
      const res = await fetch(`/api/guilds/${params.guildId}/welcome`, {
        method: 'POST',
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
    return <p style={{ color: 'var(--text-secondary)' }}>Loading welcome settings...</p>;
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem' }}>Welcome / Leave Settings</h1>
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <SectionCard
          title="Welcome Message"
          config={config.welcome}
          onChange={(welcome) => setConfig((prev) => ({ ...prev, welcome }))}
          prefix="welcome"
        />
        <SectionCard
          title="Leave Message"
          config={config.leave}
          onChange={(leave) => setConfig((prev) => ({ ...prev, leave }))}
          prefix="leave"
        />
      </div>
    </div>
  );
}

function SectionCard({
  title,
  config,
  onChange,
}: {
  title: string;
  config: { enabled: boolean; channel: string; message: string; embed: boolean; embedTitle: string };
  onChange: (val: typeof config) => void;
  prefix: string;
}) {
  return (
    <div className="card">
      <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>{title}</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => onChange({ ...config, enabled: e.target.checked })}
          />
          <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>Enabled</span>
        </label>

        <div>
          <label htmlFor="channel">Channel ID</label>
          <input
            id="channel"
            className="input"
            placeholder="123456789012345678"
            value={config.channel}
            onChange={(e) => onChange({ ...config, channel: e.target.value })}
          />
        </div>

        <div>
          <label htmlFor="message">Message</label>
          <textarea
            id="message"
            className="textarea"
            placeholder="Welcome {user} to the server!"
            value={config.message}
            onChange={(e) => onChange({ ...config, message: e.target.value })}
          />
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={config.embed}
            onChange={(e) => onChange({ ...config, embed: e.target.checked })}
          />
          <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>Use Embed</span>
        </label>

        <div>
          <label htmlFor="embedTitle">Embed Title</label>
          <input
            id="embedTitle"
            className="input"
            placeholder="Welcome to the server!"
            value={config.embedTitle}
            onChange={(e) => onChange({ ...config, embedTitle: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
