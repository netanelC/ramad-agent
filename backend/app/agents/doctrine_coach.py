from langchain_core.messages import SystemMessage, HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from backend.app.config import settings
from backend.app.agents.tools import get_doctrine_text, log_reflection_session

COACH_SYSTEM_PROMPT = """אתה 'מצפן פיקודי ומאמן סוקרטי' (Doctrine Coach & Sparring Partner) של הרמ"ד.
אתה מעוגן באופן מוחלט במסמך התפיסה הפיקודית (doctrine.md) של הרמ"ד.

תפקידך בשגרה:
- לענות לשאלות דילמה פיקודית, ניהול זמן, ממשקים ויחסי אנוש לאור עקרונות הדוקטרינה.
- לבחון כל רעיון דרך 5 צירי הערך: מודיעיני, מבצעי, מקצועי, אישי ועכשווי.
- להזכיר תמיד: "מועילות מול יעילות" – תוצר יעיל שלא מועיל לאף אחד בקצה הוא גרוע!

תפקידך במצב 'אתגר אותי' או 'תחקור דו-שבועי':
- הייה שותף לאימון (Sparring Partner) נוקב ולא מתחנף ("אפכא מסתברא").
- בדוק מול הקווים האדומים (Red Lines):
  1. האם יש חוב טכנולוגי שקוף שלא נכנס לג'ירה?
  2. האם נכנסנו ל'מחקר AI אינסופי' ללא תכלית ולו"ז?
  3. האם הרחבנו פיצ'רים לפני שווידאנו שהקיים הרמטי ויציב ("האויב של האחריות הוא אחריות מקיפה")?
  4. האם נשמרו ימי הילדות והאיזון האישי?
  5. האם ראינו את כל האנשים (מיצוי זכויות, שיחות חניכה דוגריות)?
- דרוש תוצר חד: 2 נקודות לשימור ו-2 נקודות לשיפור לשבועיים הבאים.

סגנון:
- ישיר, מנהיגותי, דוגרי, חם וקשוב אך בלתי מתפשר על עקרונות היסוד.
"""

def run_doctrine_coach(user_query: str, context: dict = None) -> dict:
    """Executes the Doctrine Coach logic."""
    doctrine_content = get_doctrine_text()
    
    is_sparring = any(kw in user_query for kw in ["אתגר אותי", "תחקור", "התחככות", "סוקרטי", "קווים אדומים", "רד ליין"])

    if not settings.gemini_api_key:
        resp = "🧭 [מצפן פיקודי ותחקור]\n"
        if is_sparring:
            resp += "מצב התחככות מופעל (Sparring Mode):\n"
            resp += "1. האם נשאבת השבוע לאוטומט או ששמרת על ימי הילדות והסיבוב היומי במדור?\n"
            resp += "2. האם אתה מתפשר על חוב טכנולוגי בצוותים או מקפיד על רישום הרמטי?\n"
            resp += "3. מועילות מול יעילות: האם התוצרים השבוע באמת פגשו את צרכן הקצה בסג\"ח?\n"
            resp += "רשום לי 2 נקודות לשימור ו-2 לשיפור."
        else:
            resp += "על פי מסמך התפיסה הפיקודית:\n"
            resp += "• 'מועילות מול יעילות': תוצר יעיל טכנולוגית שלא מועיל בקצה הוא גרוע.\n"
            resp += "• 'הרמ\"ד הוא המערכת': חיילי המדור מצפים למענה מערכתי וגב פיקודי מלא."
        return {"response": resp, "context": {"is_sparring": is_sparring}}

    llm = ChatGoogleGenerativeAI(
        model=settings.gemini_reasoning_model,
        google_api_key=settings.gemini_api_key,
        temperature=0.4
    )

    mode_instruction = "הרמ\"ד ביקש התחככות/תחקור. אתגר אותו בסגנון סוקרטי לפי ה-Red Lines ושלוש שאלות התחקור!" if is_sparring else "ענה לרמ\"ד בצורה מנהיגותית המעוגנת בעקרונות הדוקטרינה."

    prompt = f"""מסמך תפיסה פיקודית של הרמ"ד:
{doctrine_content}

פניית הרמ"ד: "{user_query}"
הנחיית מצב: {mode_instruction}

השב לרמ"ד ישירות."""

    messages = [
        SystemMessage(content=COACH_SYSTEM_PROMPT),
        HumanMessage(content=prompt)
    ]
    response = llm.invoke(messages)
    content = response.content
    if isinstance(content, list):
        text = "\n".join([c.get("text", str(c)) if isinstance(c, dict) else str(c) for c in content])
    else:
        text = str(content)
    return {"response": text, "context": {"is_sparring": is_sparring}}
