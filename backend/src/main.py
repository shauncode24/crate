from dotenv import load_dotenv
load_dotenv()  # loads ../.env (root-level) before anything else imports os.environ

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .extraction.parse_router import router as parse_router

app = FastAPI(title="crate-backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_methods=["POST"],
    allow_headers=["Content-Type"],
)

app.include_router(parse_router, prefix="/api")