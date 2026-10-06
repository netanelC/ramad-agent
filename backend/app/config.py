import os
from pathlib import Path
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DOCTRINE_PATH = BASE_DIR / "doctrine.md"

class Settings(BaseModel):
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    gemini_model: str = os.getenv("GEMINI_PRO_MODEL", "gemini-3.8-flash")
    gemini_reasoning_model: str = os.getenv("GEMINI_REASONING_MODEL", "gemini-3.8-flash")
    
    database_url: str = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR}/ramad_mador.db")
    
    # Meta for Developers (WhatsApp Cloud API)
    whatsapp_access_token: str = os.getenv("WHATSAPP_ACCESS_TOKEN") or os.getenv("META_ACCESS_TOKEN", "")
    whatsapp_phone_number_id: str = os.getenv("WHATSAPP_PHONE_NUMBER_ID") or os.getenv("PHONE_NUMBER_ID", "")
    whatsapp_verify_token: str = os.getenv("WHATSAPP_VERIFY_TOKEN") or os.getenv("VERIFY_TOKEN", "ramad_verify_token")
    ramad_phone_number: str = os.getenv("RAMAD_PHONE_NUMBER") or os.getenv("ALLOWED_PHONE_NUMBER", "")
    
    doctrine_path: Path = DOCTRINE_PATH

settings = Settings()
