import re

_PROSE_SIGNALS: list[re.Pattern] = [
    re.compile(r"\bright\s+now\b", re.I),
    re.compile(r"\blately\b", re.I),
    re.compile(r"\bhonestly\b", re.I),
    re.compile(r"\bbeen\b", re.I),
    re.compile(r"\breally\b", re.I),
    re.compile(r"\bso\s+into\b", re.I),
    re.compile(r"\bon\s+repeat\b", re.I),
    re.compile(r"\bobsessed\b", re.I),
    re.compile(r"\bcan'?t\s+stop\b", re.I),
    re.compile(r"\bkeep\s+(listening|playing|coming\s+back)\b", re.I),
    re.compile(r"\blove\s+(this|how)\b", re.I),
]


def needs_llm_fallback(raw_text: str, delimiter_found: bool) -> bool:
    """
    Returns True if this line should be escalated to the LLM.

    Rules (any one sufficient):
      - delimiter_found       → always False (heuristic already split it)
      - word count ≤ 6        → short enough to be a bare title; use as-is
      - prose signal word     → clearly a sentence, not a song entry
      - comma + 2+ words after → clause structure implies prose
      - word count > 6        → long and ambiguous; escalate to be safe

    >>> needs_llm_fallback("Snowfall", delimiter_found=False)
    False
    >>> needs_llm_fallback("Painted Skies - Elaine", delimiter_found=True)
    False
    >>> needs_llm_fallback(
    ...     "honestly so into Elaine right now, painted skies on repeat",
    ...     delimiter_found=False,
    ... )
    True
    """
    if delimiter_found:
        return False

    words = raw_text.strip().split()
    if len(words) <= 6:
        return False

    if any(p.search(raw_text) for p in _PROSE_SIGNALS):
        return True

    comma_idx = raw_text.find(",")
    if comma_idx != -1:
        after_comma = raw_text[comma_idx + 1:].strip().split()
        if len(after_comma) > 2:
            return True

    # Long line with no clear title shape — escalate.
    return True
