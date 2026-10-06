from datetime import date, datetime, timedelta
from typing import Optional, List, Dict, Any
from backend.app.db.session import SessionLocal
from backend.app.db.models import Soldier, Task, ReflectionLog, CadenceRoutine
from backend.app.config import settings

def get_doctrine_text() -> str:
    """Reads the doctrine.md document"""
    if settings.doctrine_path.exists():
        with open(settings.doctrine_path, "r", encoding="utf-8") as f:
            return f.read()
    return "מסמך תפיסה פיקודית לא נמצא."

def get_soldier_by_name(name: str) -> Optional[Dict[str, Any]]:
    """Finds a soldier by full or partial name."""
    db = SessionLocal()
    try:
        soldier = db.query(Soldier).filter(Soldier.full_name.ilike(f"%{name}%")).first()
        return soldier.to_dict() if soldier else None
    finally:
        db.close()

def list_soldiers(team: Optional[str] = None, population: Optional[str] = None) -> List[Dict[str, Any]]:
    """Lists soldiers optionally filtered by team or population."""
    db = SessionLocal()
    try:
        q = db.query(Soldier)
        if team:
            q = q.filter(Soldier.team.ilike(f"%{team}%"))
        if population:
            q = q.filter(Soldier.population == population)
        return [s.to_dict() for s in q.all()]
    finally:
        db.close()

def get_discharge_upcoming(days: int = 180) -> List[Dict[str, Any]]:
    """Returns soldiers who will be discharged within the given number of days."""
    db = SessionLocal()
    try:
        target_date = date.today() + timedelta(days=days)
        soldiers = db.query(Soldier).filter(
            Soldier.release_date != None,
            Soldier.release_date <= target_date,
            Soldier.release_date >= date.today()
        ).order_by(Soldier.release_date.asc()).all()
        return [s.to_dict() for s in soldiers]
    finally:
        db.close()

def get_1on1_overdue_soldiers(days_threshold: int = 30) -> List[Dict[str, Any]]:
    """Returns soldiers who have not had a 1-on-1 meeting in more than days_threshold days."""
    db = SessionLocal()
    try:
        cutoff = date.today() - timedelta(days=days_threshold)
        soldiers = db.query(Soldier).filter(
            (Soldier.last_1on1_date == None) | (Soldier.last_1on1_date <= cutoff)
        ).all()
        return [s.to_dict() for s in soldiers]
    finally:
        db.close()

def update_soldier_notes(soldier_name: str, new_notes: Optional[str] = None, personal_goals: Optional[str] = None) -> Dict[str, Any]:
    """Updates notes or personal goals for a soldier."""
    db = SessionLocal()
    try:
        soldier = db.query(Soldier).filter(Soldier.full_name.ilike(f"%{soldier_name}%")).first()
        if not soldier:
            return {"success": False, "message": f"חייל בשם {soldier_name} לא נמצא"}
        if new_notes:
            soldier.notes = f"{soldier.notes}\n[{date.today().isoformat()}] {new_notes}" if soldier.notes else f"[{date.today().isoformat()}] {new_notes}"
        if personal_goals:
            soldier.personal_goals = personal_goals
        db.commit()
        return {"success": True, "soldier": soldier.to_dict()}
    finally:
        db.close()

def list_tasks(status: Optional[str] = None, priority: Optional[int] = None) -> List[Dict[str, Any]]:
    """Lists tasks with Tagab deadlines."""
    db = SessionLocal()
    try:
        q = db.query(Task)
        if status:
            q = q.filter(Task.status == status)
        if priority:
            q = q.filter(Task.priority == priority)
        tasks = q.order_by(Task.tagab_date.asc()).all()
        return [t.to_dict() for t in tasks]
    finally:
        db.close()

def get_due_and_overdue_tasks() -> Dict[str, Any]:
    """Returns tasks that are due today or overdue."""
    db = SessionLocal()
    try:
        today = date.today()
        overdue = db.query(Task).filter(Task.tagab_date < today, Task.status != "הושלם").all()
        due_today = db.query(Task).filter(Task.tagab_date == today, Task.status != "הושלם").all()
        upcoming = db.query(Task).filter(Task.tagab_date > today, Task.tagab_date <= today + timedelta(days=3), Task.status != "הושלם").all()
        return {
            "overdue": [t.to_dict() for t in overdue],
            "due_today": [t.to_dict() for t in due_today],
            "upcoming_3_days": [t.to_dict() for t in upcoming]
        }
    finally:
        db.close()

def create_task(title: str, tagab_date_str: str, team: Optional[str] = "רוחבי מדור", priority: int = 2, attention_level: str = "בינונית", ramad_notes: Optional[str] = None) -> Dict[str, Any]:
    """Creates a new task with a Tagab deadline."""
    db = SessionLocal()
    try:
        try:
            parsed_date = date.fromisoformat(tagab_date_str)
        except Exception:
            parsed_date = date.today() + timedelta(days=7) # ברירת מחדל שבוע
        task = Task(
            title=title,
            team=team,
            priority=priority,
            attention_level=attention_level,
            tagab_date=parsed_date,
            status="בטיפול",
            ramad_notes=ramad_notes,
            is_ramad_personal=True
        )
        db.add(task)
        db.commit()
        return {"success": True, "task": task.to_dict()}
    finally:
        db.close()

def update_task_status(task_id: int, status: str, ramad_notes: Optional[str] = None) -> Dict[str, Any]:
    """Updates a task status (e.g. הושלם, חסום, בטיפול)."""
    db = SessionLocal()
    try:
        task = db.query(Task).filter(Task.id == task_id).first()
        if not task:
            return {"success": False, "message": f"משימה {task_id} לא נמצאה"}
        task.status = status
        if status == "הושלם":
            task.completed_at = datetime.utcnow()
        if ramad_notes:
            task.ramad_notes = f"{task.ramad_notes}\n{ramad_notes}" if task.ramad_notes else ramad_notes
        db.commit()
        return {"success": True, "task": task.to_dict()}
    finally:
        db.close()

def log_reflection_session(energy_score: int, preservation_points: str, improvement_points: str, raw_dialogue: str) -> Dict[str, Any]:
    """Saves a bi-weekly self-reflection session."""
    db = SessionLocal()
    try:
        ref = ReflectionLog(
            review_date=date.today(),
            energy_score=energy_score,
            preservation_points=preservation_points,
            improvement_points=improvement_points,
            raw_dialogue=raw_dialogue
        )
        db.add(ref)
        db.commit()
        return {"success": True, "reflection": ref.to_dict()}
    finally:
        db.close()
