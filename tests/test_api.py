import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "healthy"}

def test_soldiers_list():
    res = client.get("/api/soldiers/")
    assert res.status_code == 200
    data = res.json()
    assert len(data) > 0
    assert any("אביהו אהרון" in s["full_name"] for s in data)

def test_soldiers_stats():
    res = client.get("/api/soldiers/overview/stats")
    assert res.status_code == 200
    data = res.json()
    assert data["total_soldiers"] > 0
    assert "טטריס" in data["teams"]

def test_tasks_list():
    res = client.get("/api/tasks/")
    assert res.status_code == 200
    tasks = res.json()
    assert len(tasks) > 0
    assert any("סגירת יומן" in t["title"] for t in tasks)

def test_due_tasks_summary():
    res = client.get("/api/tasks/overview/due")
    assert res.status_code == 200
    data = res.json()
    assert "due_today" in data
    assert "overdue" in data

def test_chat_endpoint_people():
    res = client.post("/api/whatsapp/chat", json={"message": "מי החיילים בצוות 1?"})
    assert res.status_code == 200
    body = res.json()
    assert body["intent"] == "people"
    assert "איתי לוי" in body["response"] or "צוות 1" in body["response"]

def test_chat_endpoint_doctrine():
    res = client.post("/api/whatsapp/chat", json={"message": "אתגר אותי על התפקוד שלי השבוע"})
    assert res.status_code == 200
    body = res.json()
    assert body["intent"] == "doctrine"
    assert isinstance(body["response"], str)
    assert len(body["response"].strip()) > 0

def test_meta_webhook_verification():
    from backend.app.config import settings
    # Valid verify token
    res = client.get(
        "/api/whatsapp/webhook",
        params={
            "hub.mode": "subscribe",
            "hub.verify_token": settings.whatsapp_verify_token,
            "hub.challenge": "12345678"
        }
    )
    assert res.status_code == 200
    assert res.text == "12345678"

    # Invalid verify token
    res_invalid = client.get(
        "/api/whatsapp/webhook",
        params={
            "hub.mode": "subscribe",
            "hub.verify_token": "wrong_token",
            "hub.challenge": "12345678"
        }
    )
    assert res_invalid.status_code == 403

def test_meta_webhook_post():
    payload = {
        "object": "whatsapp_business_account",
        "entry": [{
            "id": "12345",
            "changes": [{
                "value": {
                    "messaging_product": "whatsapp",
                    "messages": [{
                        "from": "972501234567",
                        "id": "wamid.123",
                        "type": "text",
                        "text": {"body": "מה התג\"בים שלי להיום?"}
                    }]
                },
                "field": "messages"
            }]
        }]
    }
    res = client.post("/api/whatsapp/webhook", json=payload)
    assert res.status_code == 200
    assert res.json() == {"status": "EVENT_RECEIVED"}
