import json
from datetime import date, timedelta
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from backend.app.config import settings
from backend.app.agents.tools import (
    list_tasks, get_due_and_overdue_tasks, create_task, update_task_status
)

TASK_SYSTEM_PROMPT = """אתה 'אייג'נט תג"בים ושגרות' בסייר הפיקוד של הרמ"ד (Ramad Copilot).
אחריותך:
1. ניהול מעקב המשימות האישי של הרמ"ד (Action Items) עם תאריכי יעד ברורים (תג"ב).
2. מניעת מריחה של משימות – הצפת תג"בים שעברו או שמתקרבים.
3. שמירה על עקרון "מה שלא ביומן לא קורה" – וידוא שכל משימה תחזיר תג"ב ברור.
4. יכולת לפתוח משימה חדשה מתוך בקשה של הרמ"ד, לעדכן סטטוס, או להציג תמונת מצב.

הנחיות:
- אם הרמ"ד מבקש ליצור משימה/תג"ב: זהה את הכותרת, התאריך (או חשב תאריך יעד סביר), הצוות והעדיפות, והפעל יצירה.
- אם הרמ"ד מסמן משימה כבוצעה: עדכן סטטוס ל'הושלם'.
- השב תמיד בצורה קצרה ומובנית, מתאימה לקריאה מהירה בווטסאפ.
"""

def run_task_agent(user_query: str, context: dict = None) -> dict:
    """Executes the Task & Tagab Agent logic."""
    due_data = get_due_and_overdue_tasks()
    all_open_tasks = list_tasks(status="בטיפול")

    # Simple heuristic to detect if this is a task creation request
    created_task_info = None
    if any(kw in user_query for kw in ["תוסיף משימה", "תפתח תג\"ב", "תרשום לי", "תג\"ב חדש", "תזכיר לי עד"]):
        # Extract title and create task
        title = user_query.replace("תוסיף משימה", "").replace("תפתח תג\"ב", "").replace("תרשום לי", "").strip()
        if not title:
            title = "משימה חדשה ללא כותרת"
        target_date = (date.today() + timedelta(days=7)).isoformat()
        res = create_task(title=title, tagab_date_str=target_date, priority=2)
        if res["success"]:
            created_task_info = res["task"]

    if not settings.gemini_api_key:
        resp = "📋 [סוכן תג\"בים ומשימות]\n"
        if created_task_info:
            resp += f"✅ נפתח תג\"ב חדש: *{created_task_info['title']}* לתאריך {created_task_info['tagab_date']}\n"
        if due_data["overdue"]:
            resp += f"⚠️ *משימות באיחור ({len(due_data['overdue'])}):*\n"
            for t in due_data["overdue"][:3]:
                resp += f"• {t['title']} (תג\"ב היה: {t['tagab_date']})\n"
        if due_data["due_today"]:
            resp += f"🎯 *תג\"בים להיום ({len(due_data['due_today'])}):*\n"
            for t in due_data["due_today"]:
                resp += f"• {t['title']}\n"
        if not due_data["overdue"] and not due_data["due_today"] and not created_task_info:
            resp += f"קיימות {len(all_open_tasks)} משימות פתוחות. אין משימות באיחור להיום."
        return {"response": resp, "context": {"due_data": due_data, "created": created_task_info}}

    llm = ChatGoogleGenerativeAI(
        model=settings.gemini_model,
        google_api_key=settings.gemini_api_key,
        temperature=0.1
    )

    prompt = f"""בקשת הרמ"ד: "{user_query}"

נתוני משימות במערכת:
- משימות באיחור: {json.dumps([{'title': t['title'], 'due': t['tagab_date']} for t in due_data['overdue']], ensure_ascii=False)}
- משימות להיום: {json.dumps([{'title': t['title']} for t in due_data['due_today']], ensure_ascii=False)}
- משימות ל-3 הימים הקרובים: {json.dumps([{'title': t['title'], 'due': t['tagab_date']} for t in due_data['upcoming_3_days']], ensure_ascii=False)}
- משימה שנוצרה כעת (אם רלוונטי): {json.dumps(created_task_info, ensure_ascii=False) if created_task_info else 'אין'}

נסח לרמ"ד מענה מדויק ומסודר לווטסאפ (עם סימני בולטים ותאריכים)."""

    messages = [
        SystemMessage(content=TASK_SYSTEM_PROMPT),
        HumanMessage(content=prompt)
    ]
    response = llm.invoke(messages)
    return {"response": response.content, "context": {"due_data": due_data, "created": created_task_info}}
