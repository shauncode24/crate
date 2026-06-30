// The full PKCE flow lives here. Five jobs:
//   1. loginWithSpotify()      → kick off step 1-2 (redirect to Spotify)
//   2. handleAuthCallback()    → step 3-4 (exchange the code for tokens)
//   3. saveTokens() / getTokens() → step 5 (storage)
//   4. refreshAccessToken()    → silently get a new access token when it expires
//   5. getValidAccessToken()   → the one function the rest of the app actually calls

import { generateCodeVerifier, generateCodeChallenge } from './pkce.js';

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const REDIRECT_URI = import.meta.env.VITE_SPOTIFY_REDIRECT_URI;

const SCOPES = [
  'playlist-modify-public',
  'playlist-modify-private',
  'playlist-read-private',
].join(' ');

const TOKEN_STORAGE_KEY = 'crate_spotify_tokens';
const VERIFIER_STORAGE_KEY = 'crate_pkce_verifier';

// ---------- Step 1-2: start login ----------

export async function loginWithSpotify() {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  console.log("CLIENT_ID: ", CLIENT_ID);
console.log("REDIRECT_URI: ", REDIRECT_URI);

  // sessionStorage (not localStorage) is intentional: the verifier only
  // needs to survive this one redirect round-trip, not persist forever.
  sessionStorage.setItem(VERIFIER_STORAGE_KEY, codeVerifier);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
  });

  window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

// ---------- Step 3-4: handle the redirect back ----------

export async function handleAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const error = params.get('error');

  if (error) {
    // Clear the error query param and redirect URL path in the browser address bar
    // so a subsequent manual page refresh loads the clean homepage.
    window.history.replaceState({}, document.title, '/');
    throw new Error(`Spotify authorization failed: ${error}`);
  }
  if (!code) {
    return false;
  }

  const codeVerifier = sessionStorage.getItem(VERIFIER_STORAGE_KEY);
  if (!codeVerifier) {
    throw new Error(
      'No code_verifier found in sessionStorage — did the login flow start in a different tab/session?'
    );
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    code_verifier: codeVerifier,
  });

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  saveTokens(data);
  sessionStorage.removeItem(VERIFIER_STORAGE_KEY);

  // Clean ?code=... out of the address bar so it can't be reused/leaked.
  window.history.replaceState({}, document.title, '/callback');

  return true;
}

// ---------- Step 5: storage ----------

function saveTokens({ access_token, refresh_token, expires_in }) {
  const existing = getTokens();
  const tokens = {
    access_token,
    // Spotify doesn't always return a new refresh_token on refresh calls —
    // fall back to the existing one if this response didn't include one.
    refresh_token: refresh_token || existing?.refresh_token,
    expires_at: Date.now() + expires_in * 1000,
  };
  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
}

export function getTokens() {
  const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function isLoggedIn() {
  return !!getTokens();
}

// ---------- Silent refresh ----------

async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
  });

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token refresh failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  saveTokens(data);
  return data.access_token;
}

// ---------- The function everything else should call ----------

export async function getValidAccessToken() {
  const tokens = getTokens();
  if (!tokens) {
    throw new Error('Not logged in — call loginWithSpotify() first.');
  }

  // Refresh a bit early (60s buffer) so a request never lands right on
  // the edge of expiry.
  const expiringSoon = Date.now() > tokens.expires_at - 60_000;
  if (!expiringSoon) {
    return tokens.access_token;
  }

  if (!tokens.refresh_token) {
    clearTokens();
    throw new Error('Access token expired and no refresh token available — please log in again.');
  }

  return refreshAccessToken(tokens.refresh_token);
}