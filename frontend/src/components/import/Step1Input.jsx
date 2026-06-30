import { useState } from 'react';
import { extractSongs } from '../../extraction/extract.js';
import './Step1Input.css';

/**
 * Step1Input — paste + AI extraction screen.
 *
 * Same functionality as the original inline block in importPipeline.jsx:
 *   - holds rawInput locally
 *   - calls extractSongs(rawInput) on submit
 *   - on success, hands (rawText, result) up to the parent via onExtracted()
 *
 * Props:
 *   onExtracted(rawText, result) — called with the raw input text and the
 *                                   extractSongs() result
 */
export default function Step1Input({ onExtracted }) {
  const [rawInput, setRawInput] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | error
  const [error, setError] = useState(null);

  async function handleExtract() {
    if (!rawInput.trim() || status === 'loading') return;
    setStatus('loading');
    setError(null);
    try {
      const result = await extractSongs(rawInput);
      onExtracted(rawInput, result);
    } catch (err) {
      setError(err.message || 'Failed to extract songs');
      setStatus('error');
      return;
    }
    setStatus('idle');
  }

  return (
    <div className="step1">
      <div className="step1__intro">
        <h2 className="step1__title">Paste your tracks</h2>
        <p className="step1__subtitle">
          Paste a list of songs from anywhere. We'll find them on Spotify.
        </p>
      </div>

      <textarea
        className="step1__textarea"
        value={rawInput}
        onChange={(e) => setRawInput(e.target.value)}
        placeholder={'e.g.\nBohemian Rhapsody - Queen\nHotel California - Eagles'}
        spellCheck={false}
      />

      <div className="step1__actions">
        <button
          className="step1__submit"
          onClick={handleExtract}
          disabled={!rawInput.trim() || status === 'loading'}
        >
          {status === 'loading' && <span className="step1__spinner" aria-hidden="true" />}
          {status === 'loading' ? 'Extracting…' : 'Find songs'}
        </button>
        {status === 'error' && <p className="step1__error">{error}</p>}
      </div>
    </div>
  );
}