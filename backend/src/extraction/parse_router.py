from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator

from .llm_fallback import extract_with_llm

router = APIRouter()


class ParseLLMRequest(BaseModel):
    raw_text: str

    @field_validator("raw_text")
    @classmethod
    def not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("raw_text must not be empty.")
        if len(v) > 20000:
            raise ValueError("raw_text must be 20000 characters or fewer.")
        return v


class Song(BaseModel):
    title: str
    artist: str | None


class ParseLLMResponse(BaseModel):
    songs: list[Song]


@router.post("/parse/llm", response_model=ParseLLMResponse)
async def parse_llm(body: ParseLLMRequest) -> ParseLLMResponse:
    """
    POST /api/parse/llm
    Body:    { "raw_text": "..." }
    Returns: { "songs": [{ "title": "...", "artist": "..." | null }] }
    """
    try:
        songs = await extract_with_llm(body.raw_text)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return ParseLLMResponse(songs=[Song(**s) for s in songs])