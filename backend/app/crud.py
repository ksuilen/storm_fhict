from sqlalchemy.orm import Session
from sqlalchemy import func as sql_func # Alias om conflicten te voorkomen met datetime.func
from datetime import datetime, timezone
import secrets # Voor voucher code generatie
import string  # Voor voucher code generatie
import os      # Voor paden
import re      # Voor slugify

from . import models, schemas, security # security voor password hashing
from .models import User, StormRun, Voucher, SystemConfiguration # Expliciet importeren
from .schemas import UserCreate, UserUpdate, VoucherCreate, VoucherUpdate, StormRunCreate, StormRunUpdate, SystemConfigurationUpdate # etc.
from .core.config import settings # Nodig voor STORM_OUTPUT_DIR

# === User CRUD ===
def get_user(db: Session, user_id: int) -> User | None:
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(models.User).filter(models.User.email == email).first()

def get_users(
    db: Session, skip: int = 0, limit: int = 100, only_admins: bool = False
) -> list[User]:
    query = db.query(models.User)
    if only_admins:
        # Ervan uitgaande dat User model een 'role' attribute heeft dat 'admin' kan zijn
        query = query.filter(models.User.role == "admin") 
    return query.offset(skip).limit(limit).all()

def create_user(db: Session, *, user_in: UserCreate, force_admin_role: bool = False) -> User:
    hashed_password = security.get_password_hash(user_in.password)
    # Gebruik model_dump voor Pydantic v2, anders dict
    db_user_data = user_in.model_dump(exclude_unset=True, exclude={"password"}) 
    
    db_user = models.User(**db_user_data, hashed_password=hashed_password)
    
    if force_admin_role:
        db_user.role = "admin"
    elif not hasattr(user_in, 'role') or not user_in.role: # Als UserCreate geen rol specificeert
        db_user.role = "user" # Default naar 'user' als niet geforceerd admin
    else:
        db_user.role = user_in.role # Neem rol uit schema indien aanwezig en niet geforceerd
        
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def update_user(
    db: Session, *, db_user: User, user_in: UserUpdate
) -> User:
    update_data = user_in.model_dump(exclude_unset=True)

    if "password" in update_data and update_data["password"]:
        hashed_password = security.get_password_hash(update_data["password"])
        del update_data["password"]
        update_data["hashed_password"] = hashed_password
    
    for field, value in update_data.items():
        setattr(db_user, field, value)
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def delete_user(db: Session, *, user_id: int) -> User | None:
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if db_user:
        db.delete(db_user)
        db.commit()
    return db_user

# === Voucher CRUD ===
DEFAULT_VOUCHER_CODE_LENGTH = 16

def _generate_random_alphanumeric(length: int = DEFAULT_VOUCHER_CODE_LENGTH) -> str:
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))

def generate_voucher_code(db: Session, prefix: str | None = None, length: int = DEFAULT_VOUCHER_CODE_LENGTH) -> str:
    while True:
        random_part_length = length
        if prefix:
            random_part_length = max(1, length - len(prefix) -1) # -1 for the hyphen
        
        random_part = _generate_random_alphanumeric(random_part_length)
        
        if prefix:
            code = f"{prefix.upper()}-{random_part}"
        else:
            code = random_part
        
        if len(code) < 255: 
            existing_voucher = get_voucher_by_code(db, code=code)
            if not existing_voucher:
                return code
        else:
            return code

def get_voucher(db: Session, voucher_id: int) -> Voucher | None:
    return db.query(models.Voucher).filter(models.Voucher.id == voucher_id).first()

def get_voucher_by_code(db: Session, code: str) -> Voucher | None:
    return db.query(models.Voucher).filter(models.Voucher.code == code).first()

def get_all_vouchers(db: Session, skip: int = 0, limit: int = 100) -> list[Voucher]:
    return db.query(models.Voucher).order_by(models.Voucher.created_at.desc()).offset(skip).limit(limit).all()

def create_voucher(db: Session, *, voucher_in: VoucherCreate, admin_id: int | None = None) -> Voucher:
    generated_code = generate_voucher_code(db, prefix=voucher_in.prefix)
    
    db_voucher = models.Voucher(
        code=generated_code,
        prefix=voucher_in.prefix,
        max_runs=voucher_in.max_runs,
        is_active=voucher_in.is_active if voucher_in.is_active is not None else True,
        created_by_admin_id=admin_id
    )
    db.add(db_voucher)
    db.commit()
    db.refresh(db_voucher)
    return db_voucher

def update_voucher(db: Session, *, db_voucher: Voucher, voucher_in: VoucherUpdate) -> Voucher:
    voucher_data = voucher_in.model_dump(exclude_unset=True)
    for field, value in voucher_data.items():
        setattr(db_voucher, field, value)
    db_voucher.updated_at = datetime.now(timezone.utc) # Force update timestamp
    db.add(db_voucher)
    db.commit()
    db.refresh(db_voucher)
    return db_voucher

def increment_run_count(db: Session, *, db_voucher: Voucher) -> Voucher:
    db_voucher.used_runs += 1
    db_voucher.updated_at = datetime.now(timezone.utc)
    db.add(db_voucher)
    db.commit()
    db.refresh(db_voucher)
    return db_voucher

def deactivate_voucher(db: Session, *, db_voucher: Voucher) -> Voucher:
    db_voucher.is_active = False
    db_voucher.updated_at = datetime.now(timezone.utc)
    db.add(db_voucher)
    db.commit()
    db.refresh(db_voucher)
    return db_voucher

def delete_voucher(db: Session, *, voucher_id: int) -> Voucher | None:
    db_voucher = db.query(models.Voucher).filter(models.Voucher.id == voucher_id).first()
    if db_voucher:
        db.delete(db_voucher)
        db.commit()
    return db_voucher

# === Statistics CRUD ===
def get_voucher_statistics(db: Session, skip: int = 0, limit: int = 100) -> list[models.Voucher]:
    """Retrieve all vouchers with their statistics."""
    return get_all_vouchers(db, skip=skip, limit=limit) # Hergebruik bestaande functie

def get_admin_user_run_counts(db: Session) -> list[dict]:
    """Retrieve run counts for all admin users."""
    admin_users = get_users(db, only_admins=True) # Haal admin users op
    admin_stats = []
    for admin in admin_users:
        # Tel runs waarbij de admin de eigenaar is (owner_type='user')
        run_count = (
            db.query(sql_func.count(models.StormRun.id))
            .filter(models.StormRun.owner_type == "user", models.StormRun.owner_id == admin.id)
            .scalar()
        )        
        admin_stats.append({
            "user_id": admin.id,
            "email": admin.email,
            "role": admin.role, # Rol is altijd admin hier, maar voor consistentie
            "run_count": run_count or 0
        })
    return admin_stats

# === StormRun CRUD ===
def _create_topic_slug(topic_name: str) -> str:
    s = topic_name.lower()
    s = re.sub(r'[\W\s-]', '', s)  # Verwijder non-alphanumeric behalve spaties en koppeltekens
    s = re.sub(r'[\s-]+', '-', s).strip('-') # Vervang spaties/koppeltekens met een enkel koppelteken
    return s if s else "untitled_run"

def _get_run_output_dir(
    owner_type: str,
    owner_identifier: str, 
    run_id: int, 
    topic: str
) -> str:
    topic_slug = _create_topic_slug(topic)
    # Gebruik settings.STORM_OUTPUT_DIR (moet geïmporteerd zijn of via app.core.config.settings)
    return os.path.join(settings.STORM_OUTPUT_DIR, owner_type, str(owner_identifier), f"{run_id}_{topic_slug}")

def create_storm_run(db: Session, *, run_in: schemas.StormRunCreate, owner_type: str, owner_id: int) -> models.StormRun:
    db_run = models.StormRun(
        topic=run_in.topic,
        owner_type=owner_type,
        owner_id=owner_id,
        status=models.StormRunStatus.pending 
    )
    db.add(db_run)
    db.commit() 
    db.refresh(db_run)

    output_owner_identifier = str(owner_id)
    if owner_type == "voucher":
        voucher = get_voucher(db, voucher_id=owner_id) # get_voucher is nu in dit bestand
        if voucher:
            output_owner_identifier = voucher.code

    db_run.output_dir = _get_run_output_dir(
        owner_type=owner_type,
        owner_identifier=output_owner_identifier, 
        run_id=db_run.id,
        topic=db_run.topic
    )
    db.add(db_run)
    db.commit()
    db.refresh(db_run)
    return db_run

def get_storm_run(db: Session, run_id: int) -> models.StormRun | None:
    return db.query(models.StormRun).filter(models.StormRun.id == run_id).first()

def get_storm_runs_for_owner(
    db: Session, 
    *, 
    owner_type: str, 
    owner_id: int, 
    skip: int = 0, 
    limit: int = 100
) -> list[models.StormRun]:
    return (
        db.query(models.StormRun)
        .filter(models.StormRun.owner_type == owner_type, models.StormRun.owner_id == owner_id)
        .order_by(models.StormRun.start_time.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

def get_all_storm_runs_for_admin(db: Session, skip: int = 0, limit: int = 100) -> list[models.StormRun]:
    return db.query(models.StormRun).order_by(models.StormRun.start_time.desc()).offset(skip).limit(limit).all()

def update_storm_run_status(
    db: Session, 
    *, 
    db_run: models.StormRun, 
    status: models.StormRunStatus, 
    current_stage: str | None = None,
    error_message: str | None = None
) -> models.StormRun:
    db_run.status = status
    if current_stage is not None:
        db_run.current_stage = current_stage
    if error_message is not None:
        db_run.error_message = error_message
    
    current_time_utc = datetime.now(timezone.utc)
    if db_run.start_time is None and status == models.StormRunStatus.running:
        db_run.start_time = current_time_utc

    if status in [models.StormRunStatus.completed, models.StormRunStatus.failed, models.StormRunStatus.cancelled]:
        db_run.end_time = current_time_utc
        if status != models.StormRunStatus.running : # Reset stage if not running anymore
             db_run.current_stage = None
    
    db.add(db_run)
    db.commit()
    db.refresh(db_run)
    return db_run

def update_storm_run(db: Session, *, db_run: models.StormRun, run_in: schemas.StormRunUpdate) -> models.StormRun:
    run_data = run_in.model_dump(exclude_unset=True)
    for field, value in run_data.items():
        setattr(db_run, field, value)
    db_run.updated_at = datetime.now(timezone.utc) # Ervan uitgaande dat StormRun een updated_at heeft
    db.add(db_run)
    db.commit()
    db.refresh(db_run)
    return db_run

def delete_storm_run(db: Session, *, run_id: int, owner_type: str, owner_id: int) -> models.StormRun | None:
    db_run = db.query(models.StormRun).filter(
        models.StormRun.id == run_id, 
        models.StormRun.owner_type == owner_type, 
        models.StormRun.owner_id == owner_id
    ).first()
    
    if db_run:
        # Optioneel: fysiek verwijderen van output_dir
        # if db_run.output_dir and os.path.exists(db_run.output_dir):
        #     import shutil
        #     shutil.rmtree(db_run.output_dir)
        db.delete(db_run)
        db.commit()
    return db_run

def delete_storm_run_by_admin(db: Session, *, run_id: int) -> models.StormRun | None:
    db_run = db.query(models.StormRun).filter(models.StormRun.id == run_id).first()
    if db_run:
        db.delete(db_run)
        db.commit()
    return db_run

# === SystemConfiguration CRUD ===

def get_system_configuration(db: Session) -> SystemConfiguration | None:
    return db.query(models.SystemConfiguration).filter(models.SystemConfiguration.id == 1).first()

def update_system_configuration(db: Session, config_update: SystemConfigurationUpdate) -> SystemConfiguration:
    db_config = get_system_configuration(db)
    if not db_config:
        db_config = models.SystemConfiguration(id=1) 
        db.add(db_config)
    
    update_data = config_update.model_dump(exclude_unset=True) 

    for key, value in update_data.items():
        setattr(db_config, key, value)
    
    # db_config.updated_at = datetime.now(timezone.utc) # Wordt automatisch door model gedaan
    
    db.commit()
    db.refresh(db_config)
    return db_config

# Oude get_run_count_per_user functie (moet worden aangepast voor nieuwe owner model)
# def get_run_count_per_user(db: Session) -> list:
# results = (
# db.query(
# models.User.id,
# models.User.email,
# models.User.role,
# sql_func.count(models.StormRun.id).label("run_count"),
# )
# .outerjoin(models.StormRun, models.User.id == models.StormRun.user_id)
# .group_by(models.User.id, models.User.email, models.User.role)
# .order_by(sql_func.count(models.StormRun.id).desc())
# .all()
# )
# return [
# {"user_id": r.id, "email": r.email, "role": r.role, "run_count": r.run_count}
# for r in results
# ]

# Voeg hier later functies toe voor het ophalen van gebruikers op ID, etc. 