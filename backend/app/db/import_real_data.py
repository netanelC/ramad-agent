import csv
import json
from pathlib import Path
from datetime import date
from typing import List, Dict, Any
from backend.app.db.session import SessionLocal, init_db
from backend.app.db.models import Soldier

def parse_date_safe(val: str):
    if not val or val.strip().lower() in ["", "none", "null", "-", "ללא"]:
        return None
    val = val.strip()
    try:
        # Try YYYY-MM-DD
        return date.fromisoformat(val)
    except Exception:
        pass
    try:
        # Try DD/MM/YYYY
        parts = val.split("/")
        if len(parts) == 3:
            return date(int(parts[2]), int(parts[1]), int(parts[0]))
    except Exception:
        pass
    return None

def import_soldiers_from_records(records: List[Dict[str, Any]], clear_existing: bool = True):
    """Imports soldier records into the database."""
    init_db()
    db = SessionLocal()
    try:
        if clear_existing:
            print("Clearing existing soldier records...")
            db.query(Soldier).delete()
            db.commit()

        imported_count = 0
        for r in records:
            # Map various potential column header formats
            full_name = r.get("full_name") or r.get("שם מלא") or r.get("שם")
            if not full_name:
                continue
            
            team = r.get("team") or r.get("צוות") or "צוות 1"
            role = r.get("role") or r.get("תפקיד") or "מפתח"
            population = r.get("population") or r.get("סוג אוכלוסיה") or r.get("אוכלוסיה") or "סדיר"
            rank = r.get("rank") or r.get("דרגה") or ""
            city = r.get("city") or r.get("עיר") or r.get("עיר מגורים") or ""
            education = r.get("סטטוס תואר") or r.get("education") or r.get("השכלה") or r.get("סטטוס השכלה") or ""
            welfare = r.get("התאמות ת\"ש ומעמד מיוחד") or r.get("התאמות ת\"ש") or r.get("welfare") or r.get("ת\"ש") or r.get("ת\"ש / פטורים") or ""
            naat_role = r.get("naat_role") or r.get("נע\"ת") or r.get("תפקיד משני") or ""
            awards = r.get("סטטוס הצטיינויות והוקרה") or r.get("הצטיינויות והוקרה") or r.get("awards") or r.get("הצטיינויות") or ""
            notes = r.get("notes") or r.get("הערות") or r.get("הערות רמ\"ד") or ""
            personal_goals = r.get("personal_goals") or r.get("יעדים") or r.get("יעדים אישיים") or ""
            
            rel_date_raw = r.get("release_date") or r.get("תאריך שחרור")
            release_date = parse_date_safe(str(rel_date_raw)) if rel_date_raw else None

            last_1on1_raw = r.get("תאריך מפגש אחרון") or r.get("last_1on1_date") or r.get("תאריך שיחה אחרונה")
            last_1on1_date = parse_date_safe(str(last_1on1_raw)) if last_1on1_raw else None

            soldier = Soldier(
                full_name=full_name.strip(),
                team=team.strip(),
                role=role.strip(),
                population=population.strip(),
                rank=rank.strip() if rank else None,
                city=city.strip() if city else None,
                education=education.strip() if education else None,
                welfare=welfare.strip() if welfare else None,
                release_date=release_date,
                naat_role=naat_role.strip() if naat_role else None,
                awards=awards.strip() if awards else None,
                notes=notes.strip() if notes else None,
                last_1on1_date=last_1on1_date,
                personal_goals=personal_goals.strip() if personal_goals else None
            )
            db.add(soldier)
            imported_count += 1

        db.commit()
        print(f"Successfully imported {imported_count} real soldiers into the database.")
        return imported_count
    finally:
        db.close()

def import_from_csv(file_path: str):
    """Imports from CSV file with UTF-8 encoding."""
    path = Path(file_path)
    if not path.exists():
        print(f"File {file_path} not found.")
        return 0
    with open(path, mode="r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        records = [row for row in reader]
    return import_soldiers_from_records(records, clear_existing=True)

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        import_from_csv(sys.argv[1])
    else:
        print("Usage: python -m backend.app.db.import_real_data <path_to_csv>")
