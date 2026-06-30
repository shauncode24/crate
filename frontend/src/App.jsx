import { useEffect, useState } from 'react';
import {
  loginWithSpotify,
  handleAuthCallback,
  getValidAccessToken,
  isLoggedIn,
  clearTokens,
} from './auth/spotifyAuth.js';

import WelcomeScreen from './components/welcome/WelcomeScreen.jsx';
import SongsInput        from './components/songsInput.jsx';
import ResolverPlayground from './components/resolverPlayground.jsx';
import ImportPipeline    from './components/importPipeline.jsx';
import './App.css';
import ImportPage from './pages/ImportPage.jsx';

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

  // ── Not logged in yet: show the welcome / login screen ──
  if (authStatus === 'checking' || authStatus === 'logged-out' || authStatus === 'error') {
    return (
      <WelcomeScreen
        authStatus={authStatus}
        error={error}
        onLogin={loginWithSpotify}
      />
    );
  }

  // ── Logged in: render the ImportPage flow directly ──
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <ImportPage
          isLoggedIn={true}
          profile={profile}
          onLogout={handleLogout}
        />
      </main>
    </div>
  );
}