'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface TicketPanel {
  id: string;
  guildId: string;
  channelId: string;
  messageId: string | null;
  title: string;
  description: string | null;
  mode: 'button' | 'dropdown';
  categoryId: string | null;
  category: { id: string; name: string } | null;
  archived: boolean;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

type ActionState = 'idle' | 'recreating' | 'archiving' | 'deleting';

export default function PanelsPage() {
  const params = useParams<{ guildId: string }>();
  const router = useRouter();
  const [panels, setPanels] = useState<TicketPanel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [actionInFlight, setActionInFlight] = useState<{ id: string; state: ActionState } | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/guilds/${params.guildId}/tickets/panels${
        includeArchived ? '?includeArchived=true' : ''
      }`;
      const res = await fetch(url);
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      if (!res.ok) {
        setError(`Failed to load panels (${res.status})`);
        setLoading(false);
        return;
      }
      const json: TicketPanel[] = await res.json();
      setPanels(Array.isArray(json) ? json : []);
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }, [params.guildId, includeArchived, router]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRecreate(panel: TicketPanel) {
    if (!confirm(`Recreate the panel "${panel.title}"? A new message will be sent to <#${panel.channelId}>.`)) {
      return;
    }
    setActionInFlight({ id: panel.id, state: 'recreating' });
    setActionMessage(null);
    try {
      const res = await fetch(
        `/api/guilds/${params.guildId}/tickets/panels/${panel.id}/recreate`,
        { method: 'POST' }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionMessage(`Recreate failed: ${data.error ?? res.status}`);
        return;
      }
      setActionMessage(`Panel recreated. New message id: ${data.messageId}`);
      await load();
    } catch (e) {
      setActionMessage(`Recreate failed: ${(e as Error).message}`);
    } finally {
      setActionInFlight(null);
    }
  }

  async function handleArchiveToggle(panel: TicketPanel) {
    const willArchive = !panel.archived;
    setActionInFlight({ id: panel.id, state: 'archiving' });
    setActionMessage(null);
    try {
      const res = await fetch(
        `/api/guilds/${params.guildId}/tickets/panels/${panel.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ archived: willArchive }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setActionMessage(
          `${willArchive ? 'Archive' : 'Unarchive'} failed: ${data.error ?? res.status}`
        );
        return;
      }
      setActionMessage(willArchive ? 'Panel archived.' : 'Panel unarchived.');
      await load();
    } catch (e) {
      setActionMessage(`${willArchive ? 'Archive' : 'Unarchive'} failed: ${(e as Error).message}`);
    } finally {
      setActionInFlight(null);
    }
  }

  async function handleDelete(panel: TicketPanel) {
    if (
      !confirm(
        `Delete the panel record "${panel.title}"?\n\n` +
          'This removes the record from the dashboard. The Discord message will remain in place ' +
          '(recreate first if you want to overwrite it).'
      )
    ) {
      return;
    }
    setActionInFlight({ id: panel.id, state: 'deleting' });
    setActionMessage(null);
    try {
      const res = await fetch(
        `/api/guilds/${params.guildId}/tickets/panels/${panel.id}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setActionMessage(`Delete failed: ${data.error ?? res.status}`);
        return;
      }
      setActionMessage('Panel record deleted.');
      await load();
    } catch (e) {
      setActionMessage(`Delete failed: ${(e as Error).message}`);
    } finally {
      setActionInFlight(null);
    }
  }

  async function handleEdit(panel: TicketPanel, newTitle: string, newDescription: string) {
    setActionInFlight({ id: panel.id, state: 'archiving' }); // generic 'busy'
    setActionMessage(null);
    try {
      const res = await fetch(
        `/api/guilds/${params.guildId}/tickets/panels/${panel.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: newTitle.trim() || panel.title,
            description: newDescription,
          }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setActionMessage(`Edit failed: ${data.error ?? res.status}`);
        return;
      }
      setActionMessage('Panel updated. (Discord message not re-sent; click Recreate to apply.)');
      await load();
    } catch (e) {
      setActionMessage(`Edit failed: ${(e as Error).message}`);
    } finally {
      setActionInFlight(null);
    }
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div>
          <a
            href={`/guilds/${params.guildId}/tickets`}
            style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}
          >
            &larr; Back to Tickets
          </a>
          <h1 style={{ fontSize: '1.5rem', marginTop: '0.25rem' }}>Ticket Panels</h1>
        </div>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
          />
          Show archived
        </label>
      </div>

      {actionMessage && (
        <div
          className="card"
          style={{
            marginBottom: '1rem',
            borderColor: 'var(--accent)',
            color: 'var(--text-primary)',
            fontSize: '0.9rem',
          }}
        >
          {actionMessage}
        </div>
      )}

      {error && (
        <div
          className="card"
          style={{
            marginBottom: '1rem',
            borderColor: 'var(--danger)',
            color: 'var(--danger)',
          }}
        >
          {error}
        </div>
      )}

      <div className="card">
        {loading ? (
          <p style={{ color: 'var(--text-secondary)' }}>Loading panels...</p>
        ) : panels.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>
            No ticket panels yet. Use <code>/ticket panel</code> in Discord to create one.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {panels.map((panel) => (
              <PanelRow
                key={panel.id}
                panel={panel}
                busy={actionInFlight?.id === panel.id ? actionInFlight.state : null}
                onRecreate={handleRecreate}
                onArchiveToggle={handleArchiveToggle}
                onDelete={handleDelete}
                onEdit={handleEdit}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PanelRow({
  panel,
  busy,
  onRecreate,
  onArchiveToggle,
  onDelete,
  onEdit,
}: {
  panel: TicketPanel;
  busy: ActionState | null;
  onRecreate: (p: TicketPanel) => void;
  onArchiveToggle: (p: TicketPanel) => void;
  onDelete: (p: TicketPanel) => void;
  onEdit: (p: TicketPanel, title: string, description: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(panel.title);
  const [editDescription, setEditDescription] = useState(panel.description ?? '');

  const isBusy = busy !== null;

  return (
    <div
      style={{
        padding: '1rem',
        backgroundColor: 'var(--bg-primary)',
        borderRadius: 6,
        border: '1px solid rgba(255,255,255,0.06)',
        opacity: panel.archived ? 0.6 : 1,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, minWidth: 240 }}>
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <input
                className="input"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Title"
                maxLength={256}
              />
              <textarea
                className="textarea"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Description (leave blank for default)"
                maxLength={2000}
              />
            </div>
          ) : (
            <>
              <div style={{ fontWeight: 600 }}>{panel.title}</div>
              {panel.description && (
                <div
                  style={{
                    fontSize: '0.85rem',
                    color: 'var(--text-secondary)',
                    marginTop: '0.25rem',
                  }}
                >
                  {panel.description}
                </div>
              )}
            </>
          )}
          <div
            style={{
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
              marginTop: '0.5rem',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <span>Mode: <strong>{panel.mode}</strong></span>
            {panel.category && <span>Category: {panel.category.name}</span>}
            <span>
              Channel: <code>{panel.channelId}</code>
            </span>
            {panel.messageId && (
              <span>
                Message: <code>{panel.messageId}</code>
              </span>
            )}
            <span>Created: {new Date(panel.createdAt).toLocaleDateString()}</span>
            {panel.archived && (
              <span
                style={{
                  padding: '0.1rem 0.4rem',
                  borderRadius: 4,
                  backgroundColor: 'rgba(160, 163, 200, 0.15)',
                  color: 'var(--text-secondary)',
                  fontSize: '0.75rem',
                }}
              >
                Archived
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {editing ? (
            <>
              <button
                className="btn btn-primary"
                disabled={isBusy}
                onClick={() => {
                  onEdit(panel, editTitle, editDescription);
                  setEditing(false);
                }}
              >
                Save
              </button>
              <button
                className="btn btn-secondary"
                disabled={isBusy}
                onClick={() => {
                  setEditTitle(panel.title);
                  setEditDescription(panel.description ?? '');
                  setEditing(false);
                }}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                className="btn btn-primary"
                disabled={isBusy}
                onClick={() => onRecreate(panel)}
              >
                {busy === 'recreating' ? 'Recreating...' : 'Recreate'}
              </button>
              <button
                className="btn btn-secondary"
                disabled={isBusy}
                onClick={() => setEditing(true)}
              >
                Edit
              </button>
              <button
                className="btn btn-secondary"
                disabled={isBusy}
                onClick={() => onArchiveToggle(panel)}
              >
                {busy === 'archiving' ? '...' : panel.archived ? 'Unarchive' : 'Archive'}
              </button>
              <button
                className="btn btn-secondary"
                disabled={isBusy}
                onClick={() => onDelete(panel)}
                style={{ color: 'var(--danger)' }}
              >
                {busy === 'deleting' ? '...' : 'Delete'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
