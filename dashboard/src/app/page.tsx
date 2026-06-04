export default function HomePage() {
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
      <div style={{ marginBottom: '2rem' }}>
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent), #9b59b6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
            fontSize: '2rem',
            fontWeight: 700,
            color: '#fff',
          }}
        >
          AK
        </div>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
          Aethoria&apos;s Keep Dashboard
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: 480 }}>
          Manage your Discord server settings, tickets, giveaways, and more — all in one place.
        </p>
      </div>
      <a href="/api/auth/login" className="btn btn-primary" style={{ fontSize: '1rem', padding: '0.75rem 2rem' }}>
        Login with Discord
      </a>
    </div>
  );
}
