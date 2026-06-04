'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface SectionConfig {
  enabled: boolean;
  channelId: string;
  message: string;
  embedEnabled: boolean;
  embedTitle: string;
}

interface WelcomeConfig {
  welcome: SectionConfig;
  leave: SectionConfig;
}

interface ApiSection {
  id: string;
  guildId: string;
  type: 'welcome' | 'leave';
  channelId: string | null;
  message: string;
  embedEnabled: boolean;
  embedTitle: string | null;
}

const defaultConfig: WelcomeConfig = {
  welcome: { enabled: false, channelId: '', message: '', embedEnabled: false, embedTitle: '' },
  leave: { enabled: false, channelId: '', message: '', embedEnabled: false, embedTitle: '' },
};

function fromApi(sections: ApiSection[]): WelcomeConfig {
  const out: WelcomeConfig = {
    welcome: { ...defaultConfig.welcome },
    leave: { ...defaultConfig.leave },
  };
  for (const s of sections) {
    if (s.type === 'welcome' || s.type === 'leave') {
      out[s.type] = {
        enabled: true,
        channelId: s.channelId ?? '',
        message: s.message ?? '',
        embedEnabled: !!s.embedEnabled,
        embedTitle: s.embedTitle ?? '',
      };
    }
  }
  return out;
}

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
          setError(`Failed to load welcome settings (${res.status})`);
          setLoading(false);
          return;
        }
        const json: ApiSection[] = await res.json();
        setConfig(fromApi(Array.isArray(json) ? json : []));
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
        body: JSON.stringify({
          welcome: {
            channelId: config.welcome.channelId,
            message: config.welcome.message,
            embedEnabled: config.welcome.embedEnabled,
            embedTitle: config.welcome.embedTitle,
          },
          leave: {
            channelId: config.leave.channelId,
            message: config.leave.message,
            embedEnabled: config.leave.embedEnabled,
            embedTitle: config.leave.embedTitle,
          },
        }),
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
          messagePlaceholder="Welcome {user} to the server!"
          defaultMessage="Welcome {user} to {server}!"
        />
        <SectionCard
          title="Leave Message"
          config={config.leave}
          onChange={(leave) => setConfig((prev) => ({ ...prev, leave }))}
          messagePlaceholder="{user} has left the server."
          defaultMessage="{user} has left {server}."
        />
      </div>
    </div>
  );
}

function SectionCard({
  title,
  config,
  onChange,
  messagePlaceholder,
  defaultMessage,
}: {
  title: string;
  config: SectionConfig;
  onChange: (val: SectionConfig) => void;
  messagePlaceholder: string;
  defaultMessage: string;
}) {
  return (
    <div className="card">
      <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>{title}</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label htmlFor={`${title}-channel`}>Channel ID</label>
          <input
            id={`${title}-channel`}
            className="input"
            placeholder="123456789012345678"
            value={config.channelId}
            onChange={(e) => onChange({ ...config, channelId: e.target.value })}
          />
        </div>

        <div>
          <label htmlFor={`${title}-message`}>Message</label>
          <textarea
            id={`${title}-message`}
            className="textarea"
            placeholder={messagePlaceholder}
            value={config.message}
            onChange={(e) => onChange({ ...config, message: e.target.value })}
          />
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Variables: {'{user}'} {'{server}'} {'{memberCount}'}. Leave blank for default.
          </p>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={config.embedEnabled}
            onChange={(e) => onChange({ ...config, embedEnabled: e.target.checked })}
          />
          <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>Use Embed</span>
        </label>

        <div>
          <label htmlFor={`${title}-embedTitle`}>Embed Title (optional)</label>
          <input
            id={`${title}-embedTitle`}
            className="input"
            placeholder="Welcome!"
            value={config.embedTitle}
            onChange={(e) => onChange({ ...config, embedTitle: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
