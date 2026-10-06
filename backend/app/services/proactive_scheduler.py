import logging
import asyncio
from datetime import date
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from backend.app.config import settings
from backend.app.agents.tools import get_due_and_overdue_tasks, get_1on1_overdue_soldiers, get_discharge_upcoming
from backend.app.services.whatsapp_client import send_whatsapp_message

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()

async def send_morning_briefing():
    """Generates and sends the daily proactive morning brief to the Ramad."""
    logger.info("Running daily proactive morning briefing...")
    due_data = get_due_and_overdue_tasks()
    overdue_1on1 = get_1on1_overdue_soldiers(30)
    discharges = get_discharge_upcoming(90)
    
    today_str = date.today().strftime("%d/%m/%Y")
    
    msg_lines = [
        f"🌅 *בוקר טוב רמ\"ד! בריף פיקודי יומי – {today_str}*",
        ""
    ]
    
    # 1. Action Items & Tagabs
    if due_data["due_today"]:
        msg_lines.append(f"🎯 *תג\"בים להיום ({len(due_data['due_today'])}):*")
        for t in due_data["due_today"]:
            msg_lines.append(f"  • {t['title']} ({t['team'] or 'כללי'})")
        msg_lines.append("")
    else:
        msg_lines.append("🎯 *תג\"בים להיום:* אין תג\"בים שמסתיימים היום.")
        msg_lines.append("")

    if due_data["overdue"]:
        msg_lines.append(f"⚠️ *תג\"בים באיחור ({len(due_data['overdue'])}):*")
        for t in due_data["overdue"][:3]:
            msg_lines.append(f"  • {t['title']} (היה ל-{t['tagab_date']})")
        msg_lines.append("")

    # 2. People & 1-on-1s
    if overdue_1on1:
        msg_lines.append(f"👥 *אנשים – חייבים שיחת חניכה (מעל 30 יום):*")
        for s in overdue_1on1[:3]:
            msg_lines.append(f"  • {s['full_name']} ({s['team']}, {s['role']})")
        msg_lines.append("")

    # 3. Discharges in 90 days
    if discharges:
        msg_lines.append(f"⏳ *משתחררים ב-90 יום הקרובים:*")
        for s in discharges[:2]:
            msg_lines.append(f"  • {s['full_name']} ({s['team']}) – {s['release_date']}")
        msg_lines.append("")

    msg_lines.append("💪 _\"מועילות מול יעילות – שהטכנולוגיה תשרת את הקצה! יום מוצלח.\"_")
    
    full_message = "\n".join(msg_lines)
    
    if settings.ramad_phone_number:
        await send_whatsapp_message(settings.ramad_phone_number, full_message)
    else:
        logger.info(f"Morning brief generated:\n{full_message}")

async def send_thursday_planning_reminder():
    """Thursday 16:00 reminder to plan 2 weeks ahead."""
    logger.info("Running Thursday planning reminder...")
    msg = (
        "📅 *יום חמישי – מה שלא ביומן לא קורה!*\n\n"
        "תזכורת לפי הדוקטרינה: שריין עכשיו 30 דקות לסגירת היומן לשבועיים הקרובים.\n"
        "• ודא ימי ילדות (יציאה מוקדמת / הגעה מאוחרת)\n"
        "• שריון זמן ל'לכלך את הידיים בקוד'\n"
        "• סגירת תג\"בים פתוחים לשבוע הבא"
    )
    if settings.ramad_phone_number:
        await send_whatsapp_message(settings.ramad_phone_number, msg)

def start_scheduler():
    """Starts background proactive cron jobs."""
    # Morning brief at 07:45 Sun-Thu
    scheduler.add_job(
        send_morning_briefing,
        CronTrigger(day_of_week='sun,mon,tue,wed,thu', hour=7, minute=45)
    )
    
    # Thursday planning reminder at 16:00
    scheduler.add_job(
        send_thursday_planning_reminder,
        CronTrigger(day_of_week='thu', hour=16, minute=0)
    )
    
    scheduler.start()
    logger.info("Proactive Scheduler started successfully.")
