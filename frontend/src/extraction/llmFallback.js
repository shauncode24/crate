// needsLLMFallback()  — pure confidence gate, no I/O
// extractWithLLM()    — thin wrapper around POST /api/parse/llm
//                       The actual LLM call and API key live in the backend.

// ---------------------------------------------------------------------------
// 1. Confidence gate (pure — no secrets, no I/O)
// ---------------------------------------------------------------------------

const PROSE_SIGNALS = [
  /\bright\s+now\b/i,
  /\blately\b/i,
  /\bhonestly\b/i,
  /\bbeen\b/i,
  /\breally\b/i,
  /\bso\s+into\b/i,
  /\bon\s+repeat\b/i,
  /\bobsessed\b/i,
  /\bcan'?t\s+stop\b/i,
  /\bkeep\s+(listening|playing|coming\s+back)\b/i,
  /\blove\s+(this|how)\b/i,
];

/**
 * @param {{ rawText: string, delimiterFound: boolean }} parsedSong
 * @returns {boolean}
 */
export function needsLLMFallback({ rawText, delimiterFound }) {
  if (delimiterFound) return false;

  const words = rawText.trim().split(/\s+/);
  if (words.length <= 6) return false;

  if (PROSE_SIGNALS.some((re) => re.test(rawText))) return true;

  const commaIdx = rawText.indexOf(',');
  if (commaIdx !== -1) {
    const afterComma = rawText.slice(commaIdx + 1).trim();
    if (afterComma.split(/\s+/).length > 2) return true;
  }

  return true;
}

// ---------------------------------------------------------------------------
// 2. LLM extraction — delegates to FastAPI backend, no secrets here
// ---------------------------------------------------------------------------

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

/**
 * @param {string} rawText
 * @returns {Promise<Array<{title: string, artist: string|null}>>}
 */
export async function extractWithLLM(rawText) {
  const res = await fetch(`${API_BASE}/api/parse/llm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw_text: rawText }),  // snake_case matches Pydantic model
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Backend error ${res.status}`);
  }

  const { songs } = await res.json();
  return songs;
}