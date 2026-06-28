// PKCE = Proof Key for Code Exchange.
// The whole point: prove to Spotify that the app exchanging the code
// is the SAME app that started the login, without needing a pre-shared
// secret sitting in our frontend code.
//
// We do this with two values:
//   - code_verifier  → a random string WE generate and keep secret until step 4
//   - code_challenge → a hash of the verifier, sent PUBLICLY in step 2
//
// Spotify can't reverse the hash back into the verifier, so an attacker
// who only sees the challenge (e.g. by intercepting the redirect URL)
// can't forge the token exchange in step 4 — only whoever holds the
// original verifier can.

/**
 * Generates a cryptographically random string to use as the code_verifier.
 * Spotify requires this to be 43-128 characters, URL-safe.
 */
export function generateCodeVerifier(length = 64) {
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const randomValues = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(randomValues)
    .map((v) => possible[v % possible.length])
    .join('');
}

/**
 * Derives the code_challenge from the code_verifier:
 * SHA-256 hash it, then base64url-encode the result (Spotify requires
 * base64url, not standard base64 — no +, /, or = padding).
 */
export async function generateCodeChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(digest);
}

function base64UrlEncode(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}