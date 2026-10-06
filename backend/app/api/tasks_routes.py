from typing import Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from backend.app.db.session import get_db
from backend.app.db.models import Task
from backend.app.agents.tools import get_due_and_overdue_tasks

router = APIRouter(prefix="/api/tasks", tags=["Tasks"])

class TaskCreate(BaseModel):
    title: str
    team: Optional[str] = "רוחבי מדור"
    related_soldier_id: Optional[int] = None
    priority: int = 2
    attention_level: str = "בינונית"
    tagab_date: date
    status: str = "בטיפול"
    blockers: Optional[str] = None
    ramad_notes: Optional[str] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    team: Optional[str] = None
    related_soldier_id: Optional[int] = None
    priority: Optional[int] = None
    attention_level: Optional[str] = None
    tagab_date: Optional[date] = None
    status: Optional[str] = None
    blockers: Optional[str] = None
    ramad_notes: Optional[str] = None

@router.get("/")
def list_all_tasks(
    status: Optional[str] = None,
    priority: Optional[int] = None,
    db: Session = Depends(get_db)
):
    q = db.query(Task)
    if status:
        q = q.filter(Task.status == status)
    if priority:
        q = q.filter(Task.priority == priority)
    return [t.to_dict() for t in q.order_by(Task.tagab_date.asc()).all()]

@router.get("/overview/due")
def get_due_tasks_summary():
    return get_due_and_overdue_tasks()

@router.post("/")
def create_new_task(payload: TaskCreate, db: Session = Depends(get_db)):
    task = Task(**payload.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return task.to_dict()

@router.put("/{task_id}")
def update_task(task_id: int, payload: TaskUpdate, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="משימה לא נמצאה")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(task, k, v)
    db.commit()
    db.refresh(task)
    return task.to_dict()
