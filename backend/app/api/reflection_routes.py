from typing import Optional
from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from backend.app.db.session import get_db
from backend.app.db.models import ReflectionLog

router = APIRouter(prefix="/api/reflections", tags=["Reflections"])

class ReflectionCreate(BaseModel):
    review_date: Optional[date] = None
    energy_score: int
    preservation_points: str
    improvement_points: str
    raw_dialogue: Optional[str] = None

@router.get("/")
def list_reflections(db: Session = Depends(get_db)):
    logs = db.query(ReflectionLog).order_by(ReflectionLog.review_date.desc()).all()
    return [r.to_dict() for r in logs]

@router.post("/")
def create_reflection(payload: ReflectionCreate, db: Session = Depends(get_db)):
    ref = ReflectionLog(
        review_date=payload.review_date or date.today(),
        energy_score=payload.energy_score,
        preservation_points=payload.preservation_points,
        improvement_points=payload.improvement_points,
        raw_dialogue=payload.raw_dialogue
    )
    db.add(ref)
    db.commit()
    db.refresh(ref)
    return ref.to_dict()
