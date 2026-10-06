from datetime import datetime, date
from typing import Optional, List
from sqlalchemy import (
    Column, Integer, String, Text, Date, DateTime, Boolean, ForeignKey
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class Soldier(Base):
    __tablename__ = "soldiers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    full_name = Column(String(100), nullable=False, index=True)
    team = Column(String(50), nullable=False, index=True)  # צוות 1 עד צוות 5
    population = Column(String(50), nullable=False)      # סדיר (חובה), קבע, מילואים, יועץ, אע"צ
    role = Column(String(100), nullable=True, default="")  # תפקיד
    rank = Column(String(50), nullable=True)             # סמל, סגן, סרן, אזרח
    city = Column(String(100), nullable=True)
    education = Column(String(200), nullable=True)       # תואר ראשון במדמ"ח, קורסים
    welfare = Column(String(200), nullable=True)         # הקלות ת"ש, פטורים
    release_date = Column(Date, nullable=True)           # תאריך שחרור / סיום חוזה
    naat_role = Column(String(150), nullable=True)       # נע"ת: הוואי ותרבות, קליטה (Buddy), ציוד
    awards = Column(String(200), nullable=True)          # הצטיינויות
    notes = Column(Text, nullable=True)                  # הערות רמ"ד
    last_1on1_date = Column(Date, nullable=True)         # תאריך שיחת חניכה אחרונה
    personal_goals = Column(Text, nullable=True)         # חוזה חניכה ויעדים אישיים
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    tasks = relationship("Task", back_populates="related_soldier")

    def to_dict(self):
        return {
            "id": self.id,
            "full_name": self.full_name,
            "team": self.team,
            "role": self.role,
            "population": self.population,
            "rank": self.rank,
            "city": self.city,
            "education": self.education,
            "welfare": self.welfare,
            "release_date": self.release_date.isoformat() if self.release_date else None,
            "naat_role": self.naat_role,
            "awards": self.awards,
            "notes": self.notes,
            "last_1on1_date": self.last_1on1_date.isoformat() if self.last_1on1_date else None,
            "personal_goals": self.personal_goals,
        }

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(200), nullable=False)
    team = Column(String(50), nullable=True)
    related_soldier_id = Column(Integer, ForeignKey("soldiers.id"), nullable=True)
    priority = Column(Integer, default=2)                # 1=גבוה/קריטי, 2=בינוני, 3=נמוך
    attention_level = Column(String(50), default="בינונית") # קטנה, בינונית, גדולה
    open_date = Column(Date, default=date.today)
    tagab_date = Column(Date, nullable=False, index=True) # תאריך גמר ביצוע
    status = Column(String(50), default="בטיפול")         # ממתין, בטיפול, חסום, הושלם
    blockers = Column(Text, nullable=True)
    ramad_notes = Column(Text, nullable=True)
    is_ramad_personal = Column(Boolean, default=True)     # משימה של הרמ"ד עצמו
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    related_soldier = relationship("Soldier", back_populates="tasks")

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "team": self.team,
            "related_soldier_id": self.related_soldier_id,
            "related_soldier_name": self.related_soldier.full_name if self.related_soldier else None,
            "priority": self.priority,
            "attention_level": self.attention_level,
            "open_date": self.open_date.isoformat() if self.open_date else None,
            "tagab_date": self.tagab_date.isoformat() if self.tagab_date else None,
            "status": self.status,
            "blockers": self.blockers,
            "ramad_notes": self.ramad_notes,
            "is_ramad_personal": self.is_ramad_personal,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }

class ReflectionLog(Base):
    __tablename__ = "reflection_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    review_date = Column(Date, default=date.today, index=True)
    energy_score = Column(Integer, default=7)            # 1-10 מדד אנרגיה
    preservation_points = Column(Text, nullable=True)    # 2 נקודות לשימור
    improvement_points = Column(Text, nullable=True)      # 2 נקודות לשיפור
    raw_dialogue = Column(Text, nullable=True)           # תמליל שיחת התחקור
    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "review_date": self.review_date.isoformat() if self.review_date else None,
            "energy_score": self.energy_score,
            "preservation_points": self.preservation_points,
            "improvement_points": self.improvement_points,
            "raw_dialogue": self.raw_dialogue,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

class CadenceRoutine(Base):
    __tablename__ = "cadence_routines"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    frequency = Column(String(50), nullable=False)       # יומי, שבועי, דו-שבועי, חודשי, רבעוני
    last_performed_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "frequency": self.frequency,
            "last_performed_at": self.last_performed_at.isoformat() if self.last_performed_at else None,
            "notes": self.notes,
        }
