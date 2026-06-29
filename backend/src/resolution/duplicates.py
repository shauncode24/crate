import difflib
import re
import os
import httpx
import json
import logging

logger = logging.getLogger(__name__)

_GEMINI_URL_TEMPLATE = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"

def normalize_title(title: str) -> str:
    """Normalize title by lowercasing, removing brackets/parenthesis contents, and cleaning symbols."""
    t = title.lower()
    t = re.sub(r'[\(\[\{].*?[\)\]\}]', '', t)
    t = re.sub(r'[^a-z0-9\s]', '', t)
    return " ".join(t.split())

async def confirm_near_duplicate_with_llm(new_title: str, existing_title: str) -> bool:
    """LLM fallback to verify if two titles are near-duplicates of the same underlying song."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        logger.warning("GEMINI_API_KEY is not set. Skipping LLM duplicate verification (defaulting to True).")
        return True

    prompt = (
        "You are a music playlist deduplication assistant.\n"
        "Your task is to decide whether two song titles represent the same underlying song for playlist deduplication purposes.\n"
        "We want to avoid adding duplicates. For example, 'Snowfall' and 'Snowfall (Slowed + Reverb)' or 'Snowfall (Acoustic)' are the same song.\n"
        "But 'Snowfall' and 'Snowfall Part 2' or different songs with similar names are NOT the same song.\n\n"
        f"Song 1 (new candidate): \"{new_title}\"\n"
        f"Song 2 (already in playlist): \"{existing_title}\"\n\n"
        "Return a JSON object with this exact schema:\n"
        "{\n"
        "  \"is_same_song\": true/false,\n"
        "  \"reason\": \"brief explanation\"\n"
        "}\n"
    )

    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": prompt
                    }
                ]
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json"
        }
    }

    url = _GEMINI_URL_TEMPLATE.format(api_key=api_key)
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(url, headers={"Content-Type": "application/json"}, json=payload)
        if res.status_code != 200:
            logger.error("Gemini duplicate check failed: %d - %s", res.status_code, res.text)
            return True
        data = res.json()
        raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
        raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text.strip(), flags=re.I)
        raw_text = re.sub(r"\s*```\s*$", "", raw_text)
        parsed = json.loads(raw_text)
        return bool(parsed.get("is_same_song", True))
    except Exception as e:
        logger.exception("Error in LLM duplicate verification:")
        return True

async def check_duplicates(
    resolved_matches: list[dict],
    existing_tracks: list[dict],
) -> dict:
    """
    Checks resolvedMatches against existing_tracks and batch additions.
    Returns:
    {
      "exact": [idx_of_exact_duplicates],
      "nearDuplicate": {idx_of_near_duplicate: existing_title},
      "exactTrackIds": [track_ids],
      "nearDuplicateTrackIds": {track_id: existing_title}
    }
    """
    existing_ids = {t["id"] for t in existing_tracks if t.get("id")}
    
    # Store raw existing titles to map duplicate warnings, and track their normalized forms
    existing_normalized_map = {}
    for t in existing_tracks:
        raw_title = t.get("title") or t.get("name") or ""
        if raw_title:
            norm = normalize_title(raw_title)
            if norm:
                existing_normalized_map[norm] = raw_title

    # Keep track of additions dynamically to deduplicate within the current import batch
    seen_ids = set(existing_ids)
    in_batch_normalized = dict(existing_normalized_map)

    exact_indexes = []
    near_duplicate_indexes = {}
    
    exact_track_ids = []
    near_duplicate_track_ids = {}
    llm_cache = {}  # Cache LLM responses inside request to avoid redundant calls

    async def cached_llm_check(new_t: str, exist_t: str) -> bool:
        cache_key = (new_t.lower(), exist_t.lower())
        if cache_key not in llm_cache:
            llm_cache[cache_key] = await confirm_near_duplicate_with_llm(new_t, exist_t)
        return llm_cache[cache_key]

    # Pre-scan ALL candidates in all resolved matches to compute candidate-level duplicate track mappings.
    for match in resolved_matches:
        if not match:
            continue
        candidates = []
        if match.get("chosen"):
            candidates.append(match["chosen"])
        candidates.extend(match.get("topCandidates") or [])
        candidates.extend(match.get("allCandidates") or [])

        # Deduplicate candidates list by ID
        unique_candidates = []
        seen_cand_ids = set()
        for c in candidates:
            if c.get("id") and c["id"] not in seen_cand_ids:
                seen_cand_ids.add(c["id"])
                unique_candidates.append(c)

        for c in unique_candidates:
            cid = c["id"]
            ctitle = c.get("title") or ""
            if cid in existing_ids:
                if cid not in exact_track_ids:
                    exact_track_ids.append(cid)
            elif ctitle:
                norm_c = normalize_title(ctitle)
                # Check near-duplicates against the existing playlist
                for norm_exist, raw_exist in existing_normalized_map.items():
                    sim = difflib.SequenceMatcher(None, norm_c, norm_exist).ratio()
                    if sim == 1.0:
                        near_duplicate_track_ids[cid] = raw_exist
                        break
                    elif sim > 0.85:
                        is_same = await cached_llm_check(ctitle, raw_exist)
                        if is_same:
                            near_duplicate_track_ids[cid] = raw_exist
                            break

    # Now run the index-level deduplication for the batch, processing in-order
    for i, match in enumerate(resolved_matches):
        if not match or match.get("status") == "error":
            continue

        proposed = None
        if match.get("chosen"):
            proposed = match["chosen"]
        elif match.get("status") == "review" and match.get("topCandidates"):
            proposed = match["topCandidates"][0]

        if not proposed:
            continue

        pid = proposed["id"]
        ptitle = proposed.get("title") or ""
        norm_p = normalize_title(ptitle)

        # 1. Exact ID check
        if pid in seen_ids:
            exact_indexes.append(i)
            continue

        # 2. Near-duplicate check
        is_near_dup = False
        matched_existing_title = None

        for norm_title, raw_title in in_batch_normalized.items():
            sim = difflib.SequenceMatcher(None, norm_p, norm_title).ratio()
            if sim == 1.0:
                is_near_dup = True
                matched_existing_title = raw_title
                break
            elif sim > 0.85:
                is_same = await cached_llm_check(ptitle, raw_title)
                if is_same:
                    is_near_dup = True
                    matched_existing_title = raw_title
                    break

        if is_near_dup:
            near_duplicate_indexes[i] = matched_existing_title
            seen_ids.add(pid)
            if norm_p:
                in_batch_normalized[norm_p] = ptitle
        else:
            seen_ids.add(pid)
            if norm_p:
                in_batch_normalized[norm_p] = ptitle

    return {
        "exact": exact_indexes,
        "nearDuplicate": near_duplicate_indexes,
        "exactTrackIds": exact_track_ids,
        "nearDuplicateTrackIds": near_duplicate_track_ids,
    }
