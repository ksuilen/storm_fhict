from sqlalchemy.orm import Session
from datetime import datetime

from . import models, schemas, security # security voor password hashing

# User CRUD
def get_user(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def get_users(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.User).offset(skip).limit(limit).all()

def create_user(db: Session, user: schemas.UserCreate):
    hashed_password = security.get_password_hash(user.password)
    db_user = models.User(email=user.email, hashed_password=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

# StormRun CRUD
def create_storm_run(db: Session, run: schemas.StormRunCreate, user_id: int) -> models.StormRun:
    db_run = models.StormRun(**run.dict(), user_id=user_id, status="pending") # Pydantic v1 dict()
    db.add(db_run)
    db.commit()
    db.refresh(db_run)
    return db_run

def get_storm_run(db: Session, run_id: int, user_id: int) -> models.StormRun | None:
    return db.query(models.StormRun).filter(models.StormRun.id == run_id, models.StormRun.user_id == user_id).first()

def get_storm_runs_by_user(db: Session, user_id: int, skip: int = 0, limit: int = 100) -> list[models.StormRun]:
    return (
        db.query(models.StormRun)
        .filter(models.StormRun.user_id == user_id)
        .order_by(models.StormRun.start_time.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

def update_storm_run(
    db: Session, 
    run_id: int, 
    status: str = None,
    end_time: datetime = None, 
    output_dir: str = None, 
    error_message: str = None
) -> models.StormRun | None:
    db_run = db.query(models.StormRun).filter(models.StormRun.id == run_id).first()
    if db_run:
        if status is not None:
            db_run.status = status
        if end_time is not None:
            db_run.end_time = end_time
        if output_dir is not None:
            db_run.output_dir = output_dir
        if error_message is not None:
            db_run.error_message = error_message
        db.commit()
        db.refresh(db_run)
    return db_run

# Voeg hier later functies toe voor het ophalen van gebruikers op ID, etc. 