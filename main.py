print("🚀 MAIN.PY LOADED")
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware

from api.routes import router
from api.auth import require_exec_password
from db.session import engine
from db.session import Base

# Create tables on startup (safe for Postgres + SQLite)
from db.models import metadata
metadata.create_all(bind=engine)

app = FastAPI()

app.include_router(router)


@app.get("/health")
def health_check():
    return {"ok": True}


@app.get("/exec/verify")
def exec_verify(_=Depends(require_exec_password)):
    return {"ok": True}

@app.get("/debug/cors")
def debug_cors():
    return {"cors": "alive"}

@app.get("/debug/routes")
def debug_routes():
    return [
        {"path": r.path, "methods": list(r.methods)}
        for r in app.router.routes
    ]

from fastapi.staticfiles import StaticFiles
from pathlib import Path

frontend_dist = Path(__file__).parent / "frontend" / "dist"

app.mount(
    "/",
    StaticFiles(directory=frontend_dist, html=True),
    name="frontend",
)
