import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, Request, Response, BackgroundTasks, Query, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from backend.app.agents.graph import ramad_multi_agent_graph
from backend.app.services.whatsapp_client import send_whatsapp_message, download_meta_media
from backend.app.services.audio_transcriber import transcribe_audio_with_gemini
from backend.app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/whatsapp", tags=["WhatsApp"])

class ChatTestRequest(BaseModel):
    message: str

@router.get("/webhook")
async def verify_meta_webhook(
    hub_mode: Optional[str] = Query(None, alias="hub.mode"),
    hub_verify_token: Optional[str] = Query(None, alias="hub.verify_token"),
    hub_challenge: Optional[str] = Query(None, alias="hub.challenge"),
):
    """
    Verification endpoint for Meta for Developers.
    Meta calls this GET request when you register the Webhook URL.
    """
    logger.info(f"Received Meta webhook challenge: mode={hub_mode}")
    if hub_mode == "subscribe" and hub_verify_token == settings.whatsapp_verify_token:
        logger.info("Meta Webhook verified successfully!")
        return PlainTextResponse(content=hub_challenge, status_code=200)
    
    logger.warning("Meta Webhook verification failed. Invalid verify token.")
    raise HTTPException(status_code=403, detail="Verification token mismatch")

async def process_incoming_meta_message(payload: Dict[str, Any]):
    """Processes incoming message from Meta WhatsApp Cloud API."""
    try:
        entries = payload.get("entry", [])
        for entry in entries:
            changes = entry.get("changes", [])
            for change in changes:
                value = change.get("value", {})
                messages = value.get("messages", [])
                for msg in messages:
                    sender_phone = msg.get("from")
                    msg_type = msg.get("type")
                    
                    user_text = ""
                    is_audio = False

                    # 1. Text message
                    if msg_type == "text":
                        user_text = msg.get("text", {}).get("body", "").strip()

                    # 2. Voice Note / Audio
                    elif msg_type == "audio":
                        is_audio = True
                        audio_id = msg.get("audio", {}).get("id")
                        mime_type = msg.get("audio", {}).get("mime_type", "audio/ogg; codecs=opus")
                        if audio_id:
                            audio_bytes = await download_meta_media(audio_id)
                            if audio_bytes:
                                user_text = transcribe_audio_with_gemini(audio_bytes, mime_type=mime_type.split(";")[0])
                                logger.info(f"Transcribed Meta voice note from {sender_phone}: {user_text}")
                            else:
                                user_text = "שגיאה בהורדת קובץ השמע מ-Meta."

                    if not user_text:
                        continue

                    logger.info(f"Processing WhatsApp message from {sender_phone}: {user_text}")

                    # Run Multi-Agent Graph (Supervisor -> Task Agent / People Agent / Doctrine Coach)
                    result = ramad_multi_agent_graph.invoke({
                        "user_query": user_text,
                        "messages": []
                    })

                    reply_text = result.get("final_response", "לא התקבלה תשובה מהסוכן.")
                    if is_audio:
                        reply_text = f"🎙️ *תמלול:* \"{user_text}\"\n\n{reply_text}"

                    # Send reply back to Ramad on WhatsApp
                    await send_whatsapp_message(sender_phone, reply_text)

    except Exception as e:
        logger.error(f"Error handling Meta WhatsApp webhook: {e}", exc_info=True)

@router.post("/webhook")
async def meta_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Webhook listener for Meta for Developers.
    Meta posts all WhatsApp messages and statuses here.
    """
    payload = await request.json()
    background_tasks.add_task(process_incoming_meta_message, payload)
    return {"status": "EVENT_RECEIVED"}

@router.post("/chat")
def direct_chat(payload: ChatTestRequest):
    """Direct test endpoint for conversation from Web UI or CLI."""
    result = ramad_multi_agent_graph.invoke({
        "user_query": payload.message,
        "messages": []
    })
    return {
        "query": payload.message,
        "intent": result.get("intent"),
        "response": result.get("final_response")
    }
