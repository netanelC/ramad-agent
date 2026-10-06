import logging
import httpx
from backend.app.config import settings

logger = logging.getLogger(__name__)

async def send_whatsapp_message(to_number: str, text: str) -> bool:
    """Sends a text message to a user on WhatsApp via Meta WhatsApp Cloud API (Graph API)."""
    clean_number = "".join(filter(str.isdigit, str(to_number))) if to_number else ""

    if not settings.whatsapp_access_token or not settings.whatsapp_phone_number_id:
        logger.info(f"[Meta WhatsApp Mock] To {clean_number}: {text}")
        return True

    url = f"https://graph.facebook.com/v21.0/{settings.whatsapp_phone_number_id}/messages"
    headers = {
        "Authorization": f"Bearer {settings.whatsapp_access_token}",
        "Content-Type": "application/json"
    }
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": clean_number,
        "type": "text",
        "text": {
            "preview_url": False,
            "body": text
        }
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code in [200, 201]:
                logger.info(f"WhatsApp Cloud message sent successfully to {clean_number}")
                return True
            else:
                logger.error(f"Failed to send Meta WhatsApp message: {resp.status_code} - {resp.text}")
                return False
    except Exception as e:
        logger.error(f"Error calling Meta WhatsApp Cloud API: {e}")
        return False

async def download_meta_media(media_id: str) -> bytes:
    """Fetches media binary (e.g. voice notes) from Meta Graph API."""
    if not settings.whatsapp_access_token or not media_id:
        return b""
    
    headers = {"Authorization": f"Bearer {settings.whatsapp_access_token}"}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            # 1. Get media URL
            meta_res = await client.get(f"https://graph.facebook.com/v21.0/{media_id}", headers=headers)
            if meta_res.status_code != 200:
                logger.error(f"Failed to get media URL from Meta: {meta_res.text}")
                return b""
            media_url = meta_res.json().get("url")
            if not media_url:
                return b""

            # 2. Download binary bytes
            download_res = await client.get(media_url, headers=headers)
            if download_res.status_code == 200:
                return download_res.content
            return b""
    except Exception as e:
        logger.error(f"Error downloading media from Meta: {e}")
        return b""
