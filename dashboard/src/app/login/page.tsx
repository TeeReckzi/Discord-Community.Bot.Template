'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const hasSession = document.cookie
      .split('; ')
      .some((cookie) => cookie.startsWith('aethoria_session='));
    if (hasSession) {
      router.replace('/guilds');
    } else {
      setChecking(false);
    }
  }, [router]);

  if (checking) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <p style={{ color: 'var(--text-secondary)' }}>Checking session...</p>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '2rem',
      }}
    >
      <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Login Required</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
        You need to log in with Discord to access the dashboard.
      </p>
      <a href="/api/auth/login" className="btn btn-primary" style={{ fontSize: '1rem', padding: '0.75rem 2rem' }}>
        Login with Discord
      </a>
    </div>
  );
}
