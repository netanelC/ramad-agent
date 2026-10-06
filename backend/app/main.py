import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.db.session import init_db
from backend.app.db.seed_data import seed_database
from backend.app.services.proactive_scheduler import start_scheduler
from backend.app.api.soldiers_routes import router as soldiers_router
from backend.app.api.tasks_routes import router as tasks_router
from backend.app.api.reflection_routes import router as reflection_router
from backend.app.api.whatsapp_routes import router as whatsapp_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("ramad_copilot")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing database...")
    init_db()
    seed_database()
    logger.info("Starting proactive scheduler...")
    try:
        start_scheduler()
    except Exception as e:
        logger.warning(f"Could not start scheduler: {e}")
    yield
    logger.info("Shutting down Ramad Copilot backend.")

app = FastAPI(
    title="Ramad Copilot – Multi-Agent Command System",
    description="מערכת סיוע וניהול פיקודי רמ\"ד מבוססת Multi-Agent, Gemini Pro, ווטסאפ ודשבורד ווב.",
    version="2.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(soldiers_router)
app.include_router(tasks_router)
app.include_router(reflection_router)
app.include_router(whatsapp_router)

from fastapi.responses import HTMLResponse
from pathlib import Path

STATIC_DIR = Path(__file__).resolve().parent / "static"

@app.get("/", response_class=HTMLResponse)
@app.get("/dashboard", response_class=HTMLResponse)
def dashboard():
    html_file = STATIC_DIR / "dashboard.html"
    if html_file.exists():
        return HTMLResponse(content=html_file.read_text(encoding="utf-8"))
    return HTMLResponse("<h1>Ramad Copilot – לוח בקרה</h1>")

@app.get("/api-status")
def api_status():
    return {
        "status": "online",
        "service": "Ramad Copilot Multi-Agent System",
        "doctrine": "Effectiveness over Efficiency (מועילות מול יעילות)"
    }

@app.get("/health")
def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
