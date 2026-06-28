// Single entry point for all song extraction.
// Sends the entire raw pasted text to the backend in one call.
// No heuristics. No per-line logic. No confidence scoring.

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

/**
 * @param {string} rawText  — the full pasted block, as-is
 * @returns {Promise<Array<{title: string, artist: string|null}>>}
 */
export async function extractSongs(rawText) {
  const res = await fetch(`${API_BASE}/api/parse/llm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw_text: rawText }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Backend error ${res.status}`);
  }

  const { songs } = await res.json();
  return songs;
}