import { useEffect, useState } from 'react';
import {
  loginWithSpotify,
  handleAuthCallback,
  getValidAccessToken,
  isLoggedIn,
  clearTokens,
} from './auth/spotifyAuth.js';

import SongsInput from './components/songsInput.jsx';

export default function App() {
  const [status, setStatus] = useState('checking');
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);

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
        setStatus(isLoggedIn() ? 'logged-in' : 'logged-out');
      } catch (err) {
        setError(err.message);
        setStatus('error');
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
    setStatus('logged-out');
  }

  return (
    <div style={{ fontFamily: 'sans-serif', textAlign: 'center', marginTop: '4rem' }}>

      <SongsInput />

      <h1>crate</h1>
      {status === 'checking' && <p>checking login state…</p>}
      {status === 'logged-out' && <button onClick={loginWithSpotify}>Log in with Spotify</button>}
      {status === 'logged-in' && (
        <>
          <p>You're logged in. Prove the token actually works:</p>
          <button onClick={handleFetchProfile}>Fetch my Spotify profile</button>
          <button onClick={handleLogout} style={{ marginLeft: '0.5rem' }}>Log out</button>
        </>
      )}
      {profile && <pre style={{ textAlign: 'left', display: 'inline-block', marginTop: '1rem' }}>{JSON.stringify(profile, null, 2)}</pre>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}