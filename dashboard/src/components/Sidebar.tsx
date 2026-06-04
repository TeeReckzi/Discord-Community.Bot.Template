'use client';

import { usePathname } from 'next/navigation';

interface SidebarProps {
  guildId: string;
  guildName: string;
}

const links = [
  { label: 'Overview', href: '' },
  { label: 'Tickets', href: '/tickets' },
  { label: 'Welcome/Leave', href: '/welcome' },
  { label: 'Announcements', href: '/announcements' },
  { label: 'Giveaways', href: '/giveaways' },
  { label: 'Polls', href: '/polls' },
  { label: 'Reaction Roles', href: '/roles' },
  { label: 'Social Feeds', href: '/socials' },
  { label: 'Branding', href: '/branding' },
  { label: 'Log Settings', href: '/logs' },
];

export default function Sidebar({ guildId, guildName }: SidebarProps) {
  const pathname = usePathname();
  const basePath = `/guilds/${guildId}`;

  return (
    <aside
      style={{
        width: 240,
        minHeight: '100vh',
        backgroundColor: 'var(--bg-secondary)',
        borderRight: '1px solid rgba(255, 255, 255, 0.06)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        alignSelf: 'flex-start',
      }}
    >
      <div
        style={{
          padding: '1.25rem 1rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <a
          href="/guilds"
          style={{
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
            display: 'block',
            marginBottom: '0.25rem',
          }}
        >
          &larr; Back to servers
        </a>
        <div style={{ fontWeight: 600, fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {guildName}
        </div>
      </div>

      <nav style={{ flex: 1, padding: '0.5rem 0' }}>
        {links.map((link) => {
          const href = `${basePath}${link.href ? `/${link.href.replace(/^\//, '')}` : '/overview'}`;
          const isActive = pathname === href || pathname.startsWith(href + '/');
          return (
            <a
              key={link.label}
              href={href}
              style={{
                display: 'block',
                padding: '0.625rem 1rem',
                fontSize: '0.9rem',
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                backgroundColor: isActive ? 'rgba(88, 101, 242, 0.1)' : 'transparent',
                borderRight: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                transition: 'background-color 0.15s, color 0.15s',
                textDecoration: 'none',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.03)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                }
              }}
            >
              {link.label}
            </a>
          );
        })}
      </nav>

      <div
        style={{
          padding: '1rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
        }}
      >
        Aethoria&apos;s Keep
      </div>
    </aside>
  );
}
