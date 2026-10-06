from typing import Dict, Any
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from backend.app.config import settings
from backend.app.agents.people_agent import run_people_agent
from backend.app.agents.task_agent import run_task_agent
from backend.app.agents.doctrine_coach import run_doctrine_coach

SUPERVISOR_ROUTER_PROMPT = """אתה 'סופרווייזר מולטי-אייג'נט' עבור סייר הפיקוד של הרמ"ד (Ramad Copilot).
עליך לנתח את פניית הרמ"ד ולסווג אותה לאחת מהקטגוריות הבאות:
- 'people': שאלות או עדכונים הנוגעים ל-30 חיילי המדור, זמני שחרור, תפקידי נע"ת, שיחות חניכה אישיות (1-על-1), זכויות ת"ש.
- 'task': ניהול משימות אישיות, תג"בים, תאריכי יעד, משימות באיחור, פתיחה או סגירה של משימה.
- 'doctrine': דילמות פיקודיות, התחככות, בקשת 'אתגר אותי', שאלות על תפיסת הפיקוד, קווים אדומים, תחקור דו-שבועי.
- 'mixed': בקשה המשלבת כוח אדם ומשימות/תחקור יחד.

החזר מילה אחת בלבד: people, task, doctrine, או mixed.
"""

def classify_intent(query: str) -> str:
    query_lower = query.lower()
    
    # Fast regex/keyword checks
    if any(k in query_lower for k in ["אתגר אותי", "תחקור", "התחככות", "דוקטרינה", "תפיסה פיקודית", "קווים אדומים"]):
        return "doctrine"
    if any(k in query_lower for k in ["תג\"ב", "משימה", "משימות", "תאריך יעד", "באיחור", "לו\"ז", "לסגור משימה"]):
        return "task"
    if any(k in query_lower for k in ["חייל", "חיילים", "סדיר", "מילואים", "קבע", "נע\"ת", "שחרור", "חניכה", "1-על-1", "צוות", "ספר לי על"]):
        return "people"

    # Dynamic check against database soldiers and teams
    try:
        from backend.app.agents.tools import list_soldiers
        for s in list_soldiers():
            fname = s.get("full_name", "").lower()
            team_name = s.get("team", "").lower()
            first = fname.split()[0] if fname else ""
            if (fname and fname in query_lower) or (first and len(first) > 2 and first in query_lower):
                return "people"
            if team_name and team_name in query_lower:
                return "people"
    except Exception:
        pass
        
    if not settings.gemini_api_key:
        return "people"

    try:
        llm = ChatGoogleGenerativeAI(
            model=settings.gemini_model,
            google_api_key=settings.gemini_api_key,
            temperature=0.0
        )
        res = llm.invoke([
            SystemMessage(content=SUPERVISOR_ROUTER_PROMPT),
            HumanMessage(content=query)
        ]).content.strip().lower()
        if res in ["people", "task", "doctrine", "mixed"]:
            return res
        return "mixed"
    except Exception:
        return "mixed"

def handle_user_query(query: str, audio_transcribed: bool = False) -> Dict[str, Any]:
    """Main entrypoint handling user message."""
    intent = classify_intent(query)
    responses = []
    
    if intent == "people":
        res = run_people_agent(query)
        responses.append(res["response"])
    elif intent == "task":
        res = run_task_agent(query)
        responses.append(res["response"])
    elif intent == "doctrine":
        res = run_doctrine_coach(query)
        responses.append(res["response"])
    else:  # mixed / general
        p_res = run_people_agent(query)
        t_res = run_task_agent(query)
        responses.append(p_res["response"])
        responses.append(t_res["response"])

    combined = "\n\n".join(responses)
    return {
        "intent": intent,
        "query": query,
        "response": combined,
        "audio_transcribed": audio_transcribed
    }
