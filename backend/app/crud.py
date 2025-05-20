from sqlalchemy.orm import Session
from sqlalchemy import func as sql_func # Alias om conflicten te voorkomen met datetime.func
from datetime import datetime, timezone

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
    # De rol wordt nu uit het schema gehaald, met "user" als default in UserBase/UserCreate
    db_user = models.User(email=user.email, hashed_password=hashed_password, role=user.role)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

# StormRun CRUD
def create_storm_run(db: Session, topic: str, user_id: int) -> models.StormRun: # Aangepast om topic direct te accepteren
    db_run = models.StormRun(topic=topic, user_id=user_id, status="pending") 
    db.add(db_run)
    db.commit()
    db.refresh(db_run)
    return db_run

def get_storm_run(db: Session, run_id: int, user_id: int = None, is_admin: bool = False) -> models.StormRun | None:
    query = db.query(models.StormRun).filter(models.StormRun.id == run_id)
    if not is_admin and user_id is not None:
        query = query.filter(models.StormRun.user_id == user_id)
    return query.first()

def get_storm_runs_by_user(db: Session, user_id: int, skip: int = 0, limit: int = 20) -> list[models.StormRun]:
    return db.query(models.StormRun).filter(models.StormRun.user_id == user_id).order_by(models.StormRun.start_time.desc()).offset(skip).limit(limit).all()

def get_all_storm_runs(db: Session, skip: int = 0, limit: int = 100) -> list[models.StormRun]:
    """Haalt alle StormRuns op, voor admin gebruik."""
    return db.query(models.StormRun).order_by(models.StormRun.start_time.desc()).offset(skip).limit(limit).all()

# Functies voor het updaten van StormRun status en details
def update_storm_run_status(db: Session, run_id: int, status: str, user_id: int) -> models.StormRun | None:
    db_run = get_storm_run(db, run_id=run_id, user_id=user_id) # Check eigendom
    if db_run:
        db_run.status = status
        if status == "running" and db_run.start_time is None: # Zet starttijd indien nog niet gezet
             db_run.start_time = datetime.now(timezone.utc)
        # Als de hoofdstatus niet meer 'running' is, reset de current_stage
        if status != "running":
            db_run.current_stage = None
        db.commit()
        db.refresh(db_run)
    return db_run

def update_storm_run_stage(db: Session, run_id: int, stage: str, user_id: int) -> models.StormRun | None:
    """Update alleen de current_stage van een StormRun."""
    # We gaan ervan uit dat de hoofdstatus al 'running' is als dit wordt aangeroepen.
    # Eigendom wordt gecheckt door get_storm_run.
    db_run = get_storm_run(db, run_id=run_id, user_id=user_id)
    if db_run and db_run.status == "running": # Update alleen stage als de run nog 'running' is
        db_run.current_stage = stage
        db.commit()
        db.refresh(db_run)
    return db_run

def update_storm_run_on_completion(db: Session, run_id: int, status: str, output_dir: str, user_id: int) -> models.StormRun | None:
    db_run = get_storm_run(db, run_id=run_id, user_id=user_id) # Check eigendom
    if db_run:
        db_run.status = status
        db_run.output_dir = output_dir
        db_run.end_time = datetime.now(timezone.utc)
        db_run.error_message = None # Clear error on successful completion
        db.commit()
        db.refresh(db_run)
    return db_run

def update_storm_run_on_error(db: Session, run_id: int, error_message: str, user_id: int) -> models.StormRun | None:
    db_run = get_storm_run(db, run_id=run_id, user_id=user_id) # Check eigendom
    if db_run:
        db_run.status = "failed"
        db_run.error_message = error_message
        db_run.end_time = datetime.now(timezone.utc)
        db.commit()
        db.refresh(db_run)
    return db_run

def delete_storm_run(db: Session, run_id: int, user_id: int, is_admin: bool = False) -> models.StormRun | None:
    db_run = get_storm_run(db, run_id=run_id, user_id=user_id, is_admin=is_admin)
    if db_run:
        db.delete(db_run)
        db.commit()
        return db_run 
    return None

# Admin-specifieke CRUD operaties
def get_run_count_per_user(db: Session) -> list: # Naam gecorrigeerd
    results = (
        db.query(
            models.User.id,
            models.User.email,
            models.User.role,
            sql_func.count(models.StormRun.id).label("run_count"),
        )
        .outerjoin(models.StormRun, models.User.id == models.StormRun.user_id)
        .group_by(models.User.id, models.User.email, models.User.role)
        .order_by(sql_func.count(models.StormRun.id).desc())
        .all()
    )
    return [
        {"user_id": r.id, "email": r.email, "role": r.role, "run_count": r.run_count}
        for r in results
    ]

# Voeg hier later functies toe voor het ophalen van gebruikers op ID, etc. 

# --- SystemConfiguration CRUD ---

def get_system_configuration(db: Session) -> models.SystemConfiguration | None:
    return db.query(models.SystemConfiguration).filter(models.SystemConfiguration.id == 1).first()

def update_system_configuration(db: Session, config_update: schemas.SystemConfigurationUpdate) -> models.SystemConfiguration:
    db_config = get_system_configuration(db)
    if not db_config:
        db_config = models.SystemConfiguration(id=1) # Maak aan als het niet bestaat
        db.add(db_config)
    
    # Voor Pydantic V2: 
    update_data = config_update.model_dump(exclude_unset=True) 
    # Voor Pydantic V1: 
    # update_data = config_update.dict(exclude_unset=True)

    for key, value in update_data.items():
        setattr(db_config, key, value)
    
    # db_config.updated_at = datetime.now(timezone.utc) # Wordt automatisch geupdate door onupdate=func.now() in model
    
    db.commit()
    db.refresh(db_config)
    return db_config 