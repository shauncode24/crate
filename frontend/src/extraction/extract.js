// Single entry point for all song extraction.
// Sends the entire raw pasted text to the backend in one call.
// Returns: { songs: [{title, artist, rawText, parseMethod}], playlistName, playlistDescription }

import mockSongs from './mockSongs.json';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

// Toggle this flag to switch between mock/testing and production API extraction.
const USE_MOCK = true;

/**
 * Extract songs from raw pasted text. In a single LLM call the backend also
 * suggests a playlist name and description.
 *
 * @param {string} rawText  — the full pasted block, as-is
 * @returns {Promise<{
 *   songs: Array<{title: string, artist: string|null, rawText: string, parseMethod: string}>,
 *   playlistName: string,
 *   playlistDescription: string,
 * }>}
 */
export async function extractSongs(rawText) {
  if (USE_MOCK) {
    // Simulate network delay for UI responsiveness testing
    await new Promise((resolve) => setTimeout(resolve, 600));
    // Tag each song with parseMethod. In mock mode we simulate a realistic
    // ~8% LLM fallback rate (every 12th song uses the LLM path).
    const songs = mockSongs.songs.map((song, idx) => ({
      ...song,
      parseMethod: idx % 12 === 0 ? 'llm' : 'heuristic',
    }));
    return {
      songs,
      // Mock playlist suggestion — representative of ambient/lo-fi vibes
      playlistName: 'Late Night Focus',
      playlistDescription: 'Ambient and lo-fi tracks, imported from a comfort-songs post.',
    };
  }

  const res = await fetch(`${API_BASE}/api/parse/llm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw_text: rawText }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Backend error ${res.status}`);
  }

  const data = await res.json();
  // Real LLM backend always uses the LLM path
  const songs = (data.songs ?? []).map((song) => ({ ...song, parseMethod: 'llm' }));

  return {
    songs,
    playlistName: data.playlistName ?? '',
    playlistDescription: data.playlistDescription ?? '',
  };
}