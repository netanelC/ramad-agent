from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import date
from backend.app.db.session import get_db
from backend.app.db.models import Soldier

router = APIRouter(prefix="/api/soldiers", tags=["Soldiers"])

class SoldierCreate(BaseModel):
    full_name: str
    team: str
    role: str
    population: str
    rank: Optional[str] = None
    city: Optional[str] = None
    education: Optional[str] = None
    welfare: Optional[str] = None
    release_date: Optional[date] = None
    naat_role: Optional[str] = None
    awards: Optional[str] = None
    notes: Optional[str] = None
    last_1on1_date: Optional[date] = None
    personal_goals: Optional[str] = None

class SoldierUpdate(BaseModel):
    team: Optional[str] = None
    role: Optional[str] = None
    rank: Optional[str] = None
    city: Optional[str] = None
    education: Optional[str] = None
    welfare: Optional[str] = None
    release_date: Optional[date] = None
    naat_role: Optional[str] = None
    awards: Optional[str] = None
    notes: Optional[str] = None
    last_1on1_date: Optional[date] = None
    personal_goals: Optional[str] = None

@router.get("/")
def list_all_soldiers(
    team: Optional[str] = None,
    population: Optional[str] = None,
    db: Session = Depends(get_db)
):
    q = db.query(Soldier)
    if team:
        q = q.filter(Soldier.team == team)
    if population:
        q = q.filter(Soldier.population == population)
    return [s.to_dict() for s in q.order_by(Soldier.team, Soldier.full_name).all()]

@router.get("/overview/stats")
def get_soldiers_stats(db: Session = Depends(get_db)):
    all_soldiers = db.query(Soldier).all()
    teams_distribution = {}
    pop_distribution = {}
    for s in all_soldiers:
        teams_distribution[s.team] = teams_distribution.get(s.team, 0) + 1
        pop_distribution[s.population] = pop_distribution.get(s.population, 0) + 1
    
    return {
        "total_soldiers": len(all_soldiers),
        "teams": teams_distribution,
        "populations": pop_distribution
    }

@router.get("/{soldier_id}")
def get_soldier(soldier_id: int, db: Session = Depends(get_db)):
    soldier = db.query(Soldier).filter(Soldier.id == soldier_id).first()
    if not soldier:
        raise HTTPException(status_code=404, detail="חייל לא נמצא")
    return soldier.to_dict()

@router.post("/")
def create_new_soldier(payload: SoldierCreate, db: Session = Depends(get_db)):
    soldier = Soldier(**payload.model_dump())
    db.add(soldier)
    db.commit()
    db.refresh(soldier)
    return soldier.to_dict()

@router.put("/{soldier_id}")
def update_existing_soldier(soldier_id: int, payload: SoldierUpdate, db: Session = Depends(get_db)):
    soldier = db.query(Soldier).filter(Soldier.id == soldier_id).first()
    if not soldier:
        raise HTTPException(status_code=404, detail="חייל לא נמצא")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(soldier, k, v)
    db.commit()
    db.refresh(soldier)
    return soldier.to_dict()
