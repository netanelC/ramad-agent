import base64
import logging
from backend.app.config import settings

logger = logging.getLogger(__name__)

def transcribe_audio_with_gemini(audio_bytes: bytes, mime_type: str = "audio/ogg") -> str:
    """Transcribes Hebrew military voice notes directly using Gemini multimodal audio."""
    if not settings.gemini_api_key:
        logger.warning("No GEMINI_API_KEY configured for audio transcription.")
        return "הודעה קולית שהתקבלה מהרמ\"ד (סימולציה ללא מפתח API)"

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=settings.gemini_api_key)
        
        prompt = """אתה מתמלל הודעות קוליות עבור ראש מדור (רמ"ד) טכנולוגי בצה"ל.
תמלל את ההקלטה במדויק לשפה עברית טבעית, כולל מונחים צבאיים (תג"ב, סג"ח, רש"צ, חפיפה, קבע, חניכה).
החזר רק את התמלול הנקי ללא הערות מקדימות או ניתוח."""

        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=[
                types.Part.from_bytes(data=audio_bytes, mime_type=mime_type),
                prompt
            ]
        )
        return response.text.strip()
    except Exception as e:
        logger.error(f"Error transcribing audio with Gemini: {e}")
        return "שגיאה בתמלול ההודעה הקולית."
