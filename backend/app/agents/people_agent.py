import json
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from backend.app.config import settings
from backend.app.agents.tools import (
    list_soldiers, get_soldier_by_name, get_discharge_upcoming,
    get_1on1_overdue_soldiers, update_soldier_notes
)

PEOPLE_SYSTEM_PROMPT = """אתה 'אייג'נט אנשים ופיתוח' בסייר הפיקוד של הרמ"ד (Ramad Copilot).
אחריותך:
1. שליטה מלאה בכל 30 חיילי ומפקדי המדור הפרוסים ב-5 צוותים (סדיר, קבע, מילואים, יועצים).
2. ניטור זמני שחרור והכנה להעברת מקל/חפיפות.
3. אכיפת שגרת שיחות חניכה (1-על-1) – להתריע על חיילים שלא קיימו שיחה מעל 30 יום.
4. מעקב אחר תפקידי נע"ת (תפקידים משניים כמו הוואי, ציוד, Buddy) ואיזון עומסים.
5. הקפדה על מיצוי זכויות חיילים (חובת פיקוד): ת"ש, הקלות, עבודה, ורווחה.

סגנון התקשורת:
- חד, ענייני, ממוקד וחם, בעברית צבאית תקינה.
- ציין תמיד את שם הצוות והתפקיד של החייל לצורך הקשר.
- אם מבוצע עדכון (כמו הערה או יעד אישי), אשר זאת באופן תמציתי.
"""

def run_people_agent(user_query: str, context: dict = None) -> dict:
    """Executes the People & HR Agent logic."""
    # Pre-fetch relevant context
    discharge_soon = get_discharge_upcoming(180)
    overdue_1on1 = get_1on1_overdue_soldiers(30)
    
    # Check if a specific team was mentioned (dynamically from database)
    mentioned_team = None
    all_soldiers = list_soldiers()
    unique_teams = list({s["team"] for s in all_soldiers if s.get("team")})
    for t_name in unique_teams:
        if t_name.lower() in user_query.lower():
            mentioned_team = t_name
            break

    # Check if a specific soldier was mentioned
    mentioned_soldier = None
    for s in all_soldiers:
        fname = s.get("full_name", "").lower()
        first = fname.split()[0] if fname else ""
        if (fname and fname in user_query.lower()) or (first and len(first) > 2 and first in user_query.lower()):
            mentioned_soldier = s
            break

    team_soldiers = [s for s in all_soldiers if s["team"] == mentioned_team] if mentioned_team else []

    db_context_summary = {
        "soldiers_count": len(all_soldiers),
        "discharges_next_6_months": len(discharge_soon),
        "overdue_1on1_count": len(overdue_1on1),
        "mentioned_soldier": mentioned_soldier,
        "mentioned_team": mentioned_team,
        "team_soldiers": team_soldiers
    }

    if not settings.gemini_api_key:
        # Fallback if API key is not yet configured
        res = f"👥 [סוכן אנשים ופיתוח]\n"
        if mentioned_soldier:
            s = mentioned_soldier
            res += f"📌 *פרטי חייל: {s['full_name']}*\n"
            res += f"• צוות: {s.get('team') or 'לא צוין'}\n"
            res += f"• דרגה ואוכלוסייה: {s.get('rank') or 'ללא'} ({s.get('population') or 'סדיר'})\n"
            if s.get('role'):
                res += f"• תפקיד: {s.get('role')}\n"
            res += f"• נע\"ת: {s.get('naat_role') or 'אין'}\n"
            res += f"• תאריך שחרור: {s.get('release_date') or 'לא מוגדר'}\n"
            res += f"• סטטוס תואר/השכלה: {s.get('education') or 'אין'}\n"
            res += f"• התאמות ת\"ש/מעמד: {s.get('welfare') or 'ללא'}\n"
            res += f"• הצטיינויות והוקרה: {s.get('awards') or 'ללא'}\n"
            res += f"• יעדים אישיים: {s.get('personal_goals') or 'אין'}\n"
            res += f"• שיחת חניכה אחרונה: {s.get('last_1on1_date') or 'טרם תועדה'}\n"
            if s.get('notes'):
                res += f"• הערות רמ\"ד: {s.get('notes')}\n"
        elif mentioned_team:
            res += f"חיילים בצוות *{mentioned_team}* ({len(team_soldiers)}):\n"
            for ts in team_soldiers:
                role_str = f" – {ts['role']}" if ts.get('role') else ""
                res += f"• {ts['full_name']} ({ts.get('rank') or ''} {ts['population']}){role_str}\n"
        else:
            res += f"זוהו במדור {len(all_soldiers)} חיילים ומפקדים.\n"

        if overdue_1on1 and not mentioned_soldier:
            res += f"\n⚠️ שים לב: יש {len(overdue_1on1)} חיילים ללא שיחת חניכה מעל 30 יום."
        return {"response": res, "context": db_context_summary}

    llm = ChatGoogleGenerativeAI(
        model=settings.gemini_model,
        google_api_key=settings.gemini_api_key,
        temperature=0.2
    )

    prompt = f"""שאילתת הרמ"ד: "{user_query}"

נתונים קיימים במערכת:
- חייל שזוהה בפנייה: {json.dumps(mentioned_soldier, ensure_ascii=False) if mentioned_soldier else 'לא צוין חייל ספציפי'}
- רשימת משתחררים בקרוב: {json.dumps([{'name': s['full_name'], 'team': s['team'], 'date': s['release_date']} for s in discharge_soon[:5]], ensure_ascii=False)}
- חיילים הממתינים לשיחת 1-על-1 מעל חודש: {json.dumps([{'name': s['full_name'], 'team': s['team'], 'last': s['last_1on1_date']} for s in overdue_1on1[:5]], ensure_ascii=False)}

השב לרמ"ד בצורה חדה ומדויקת."""

    messages = [
        SystemMessage(content=PEOPLE_SYSTEM_PROMPT),
        HumanMessage(content=prompt)
    ]
    response = llm.invoke(messages)
    content = response.content
    if isinstance(content, list):
        text = "\n".join([c.get("text", str(c)) if isinstance(c, dict) else str(c) for c in content])
    else:
        text = str(content)
    return {"response": text, "context": db_context_summary}
