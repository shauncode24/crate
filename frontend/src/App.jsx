import { useEffect, useState } from 'react';
import {
  loginWithSpotify,
  handleAuthCallback,
  getValidAccessToken,
  isLoggedIn,
  clearTokens,
} from './auth/spotifyAuth.js';

import SongsInput        from './components/songsInput.jsx';
import ResolverPlayground from './components/resolverPlayground.jsx';
import ImportPipeline    from './components/importPipeline.jsx';
import './App.css';

const TABS = [
  { id: 'import',   label: 'Import'   },
  { id: 'parser',   label: 'Parser'   },
  { id: 'resolver', label: 'Resolver' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('import');
  const [authStatus, setAuthStatus] = useState('checking'); // checking | logged-in | logged-out | error
  const [profile, setProfile]       = useState(null);
  const [error, setError]           = useState(null);

  useEffect(() => {
    async function init() {
      try {
        if (window.location.pathname === '/callback') {
          const handled = await handleAuthCallback();
          if (handled) {
            window.location.href = '/';
            return;
          }
        }
        setAuthStatus(isLoggedIn() ? 'logged-in' : 'logged-out');
      } catch (err) {
        setError(err.message);
        setAuthStatus('error');
      }
    }
    init();
  }, []);

  async function handleFetchProfile() {
    setError(null);
    try {
      const token = await getValidAccessToken();
      const res = await fetch('https://api.spotify.com/v1/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Spotify returned ${res.status}`);
      setProfile(await res.json());
    } catch (err) {
      setError(err.message);
    }
  }

  function handleLogout() {
    clearTokens();
    setProfile(null);
    setAuthStatus('logged-out');
  }

  const loggedIn = authStatus === 'logged-in';

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>

      {/* ── Top nav ── */}
      <nav className="app-nav">
        <div className="app-nav__tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`app-nav__tab ${activeTab === tab.id ? 'app-nav__tab--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="app-nav__auth">
          {authStatus === 'checking' && (
            <span className="app-nav__auth-hint">checking…</span>
          )}
          {authStatus === 'logged-out' && (
            <button className="app-nav__auth-btn" onClick={loginWithSpotify}>
              Log in with Spotify
            </button>
          )}
          {authStatus === 'logged-in' && (
            <>
              <button className="app-nav__auth-btn app-nav__auth-btn--ghost" onClick={handleFetchProfile}>
                {profile ? `✓ ${profile.display_name}` : 'Verify token'}
              </button>
              <button className="app-nav__auth-btn app-nav__auth-btn--ghost" onClick={handleLogout}>
                Log out
              </button>
            </>
          )}
          {authStatus === 'error' && (
            <span className="app-nav__auth-hint app-nav__auth-hint--error">{error}</span>
          )}
        </div>
      </nav>

      {/* ── Tab content ── */}
      <main>
        {activeTab === 'import'   && <ImportPipeline isLoggedIn={loggedIn} />}
        {activeTab === 'parser'   && <SongsInput />}
        {activeTab === 'resolver' && <ResolverPlayground isLoggedIn={loggedIn} />}
      </main>

      {/* Debug profile dump (dev only) */}
      {profile && (
        <pre style={{ textAlign: 'left', display: 'inline-block', margin: '1rem 40px', fontSize: 12 }}>
          {JSON.stringify(profile, null, 2)}
        </pre>
      )}
    </div>
  );
}