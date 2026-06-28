# Runs server-side so the API key never leaves the backend.
# The frontend calls POST /api/parse/llm and gets back [{title, artist}].

import json
import os
import re
import httpx

_PROMPT_PATH = os.path.join(os.path.dirname(__file__), "prompts", "music_extraction.txt")
_GEMINI_URL_TEMPLATE = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
_MODEL = "gemini-2.5-flash"


def _load_system_prompt() -> str:
    """Loads the system instruction prompt from its dedicated text file."""
    with open(_PROMPT_PATH, "r", encoding="utf-8") as f:
        return f.read().strip()


async def extract_with_llm(raw_text: str) -> list[dict]:
    """
    Sends raw_text to the Gemini API and returns extracted song entries.

    Each entry: {"title": str, "artist": str | None}

    Raises:
        RuntimeError: if GEMINI_API_KEY is unset, the API call fails,
                      or the model returns non-JSON.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set in the environment.")

    system_prompt = _load_system_prompt()

    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": raw_text
                    }
                ]
            }
        ],
        "systemInstruction": {
            "parts": [
                {
                    "text": system_prompt
                }
            ]
        },
        "generationConfig": {
            "responseMimeType": "application/json"
        }
    }

    url = _GEMINI_URL_TEMPLATE.format(model=_MODEL, api_key=api_key)

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            url,
            headers={
                "Content-Type": "application/json",
            },
            json=payload,
        )

    if response.status_code != 200:
        raise RuntimeError(
            f"Gemini API error {response.status_code}: {response.text}"
        )

    data = response.json()

    candidates = data.get("candidates", [])
    if not candidates:
        raise RuntimeError(
            f"Gemini API returned no candidates. Response: {response.text}"
        )

    parts = candidates[0].get("content", {}).get("parts", [])
    if not parts:
        raise RuntimeError(
            f"Gemini API candidate content had no parts. Response: {response.text}"
        )

    raw_content = parts[0].get("text", "")

    # Strip accidental markdown fences.
    cleaned = re.sub(r"^```(?:json)?\s*", "", raw_content.strip(), flags=re.I)
    cleaned = re.sub(r"\s*```\s*$", "", cleaned)

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            f"LLM returned non-JSON. Raw output:\n{raw_content}"
        ) from exc

    if not isinstance(parsed, list):
        raise RuntimeError(
            f"LLM returned unexpected shape (expected list). Got: {cleaned}"
        )

    return [
        {
            "title": entry["title"].strip(),
            "artist": (
                entry["artist"].strip()
                if isinstance(entry.get("artist"), str) and entry["artist"].strip()
                else None
            ),
        }
        for entry in parsed
        if isinstance(entry, dict)
        and isinstance(entry.get("title"), str)
        and entry["title"].strip()
    ]