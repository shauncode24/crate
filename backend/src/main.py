from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .extraction.parse_router      import router as parse_router
from .resolution.resolve_router    import router as resolve_router

app = FastAPI(title="crate-backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(parse_router,   prefix="/api")
app.include_router(resolve_router, prefix="/api")