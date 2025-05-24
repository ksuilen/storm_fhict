from fastapi import FastAPI, Depends, HTTPException, status, BackgroundTasks, Response, File, UploadFile, APIRouter
from fastapi.security import (
    OAuth2PasswordBearer, 
    OAuth2PasswordRequestForm, 
    HTTPBearer,
    HTTPAuthorizationCredentials
)
from fastapi.middleware.cors import CORSMiddleware # Importeer CORSMiddleware
# Verwijder de incorrecte imports
# from fastapi.openapi.models import SecurityScheme
# from fastapi.openapi.models import Components

from sqlalchemy.orm import Session
from datetime import timedelta, datetime
import os # Nodig voor pad manipulatie
from typing import TYPE_CHECKING, Optional, List, Union
import json
import shutil # Toegevoegd voor map verwijderen

from .core.config import settings
from .database import engine, Base, get_db
from . import models, schemas, crud
from .core import auth as auth_core # Importeer core.auth
from .storm_runner import get_storm_runner, STORMWikiRunner # Importeer ook Runner voor type hint
from .api.v1.endpoints import vouchers as vouchers_endpoint_router # Importeer de voucher router
from .api.v1.endpoints import login as login_api_router # Importeer de login router
# Importeer STORMWikiRunner alleen voor type hinting, niet voor directe call
if TYPE_CHECKING:
    from knowledge_storm import STORMWikiRunner

# Maak de database tabellen aan (voor dev, gebruik Alembic voor prod)
# models.Base.metadata.create_all(bind=engine) # Verplaatst naar startup event

# Definieer de security scheme voor OpenAPI / Swagger UI als dictionary
# De key "BearerAuth" moet matchen met de key in security=[...]
bearer_auth_scheme = {
    "type": "http",
    "scheme": "bearer",
    "bearerFormat": "JWT",
    "description": "Enter JWT Bearer token"
}

app = FastAPI(
    title=settings.APP_NAME,
    # Voeg de security scheme toe aan de OpenAPI componenten
    # Correcte manier is via openapi_extra of direct meegeven
    openapi_components={"securitySchemes": {"BearerAuth": bearer_auth_scheme}}
)

# --- CORS Middleware --- 
# Voeg dit toe VOORDAT je routes definieert
origins = [
    "http://localhost:3000", # De origin van je React frontend development server
    # "http://localhost:3001", # Potentiële andere dev poort
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, # TERUGGEZET naar specifieke origins
    allow_credentials=True, 
    allow_methods=["*"],    
    allow_headers=["*"],    
)

# --- Startup Event --- (Beter dan direct aanroepen)
@app.on_event("startup")
def on_startup():
    # Importeer hier app.db.base om zeker te zijn dat alle modellen zijn geladen
    # op de metadata van de Base uit app.database, voordat create_all wordt aangeroepen.
    from .db import base  # Zorgt ervoor dat modellen geregistreerd zijn
    try:
        Base.metadata.create_all(bind=engine)
        print("Database tables created successfully (if they didn't exist).")
    except Exception as e:
        print(f"Error creating database tables: {e}")
        # Je zou hier specifiekere logging of error handling kunnen toevoegen


@app.get("/")
async def read_root():
    return {"message": f"Welcome to {settings.APP_NAME}"}

# --- APIRouters ---
auth_router = APIRouter(tags=["Authentication"])
users_router = APIRouter(prefix="/users", tags=["Users"])
admin_router = APIRouter(prefix="/admin", tags=["Admin"], dependencies=[Depends(auth_core.get_current_active_admin)])
storm_router = APIRouter(prefix="/storm", tags=["Storm"])
debug_router = APIRouter(prefix="/debug", tags=["Debug"])

# --- Debug Endpoints ---
@debug_router.get("/routes")
async def debug_routes():
    """Debug endpoint to see all registered routes"""
    routes = []
    for route in app.routes:
        if hasattr(route, 'methods') and hasattr(route, 'path'):
            routes.append({
                "path": route.path,
                "methods": list(route.methods) if route.methods else [],
                "name": getattr(route, 'name', 'unnamed')
            })
    return {"routes": routes, "api_v1_str": settings.API_V1_STR}

@debug_router.get("/run/{run_id}")
async def debug_run_info(run_id: int, db: Session = Depends(get_db)):
    """Debug endpoint to see run details and path construction"""
    try:
        db_run = crud.get_storm_run(db, run_id=run_id)
        if not db_run:
            raise HTTPException(status_code=404, detail="Run not found")
        
        topic_slug = create_topic_slug(db_run.topic) if db_run.topic else "NO_TOPIC"
        
        # Constructie zoals gebruikt in API endpoints
        expected_path_structure = {
            "base_dir": settings.STORM_OUTPUT_DIR,
            "owner_id": str(db_run.owner_id),
            "run_id": str(db_run.id),
            "topic_slug": topic_slug,
            "full_path_for_files": os.path.join(settings.STORM_OUTPUT_DIR, str(db_run.owner_id), str(db_run.id), topic_slug)
        }
        
        # Constructie zoals gebruikt in background task
        background_task_path = os.path.join(settings.STORM_OUTPUT_DIR, str(db_run.owner_id), str(db_run.id))
        
        # Check of directory bestaat
        paths_exist = {
            "expected_path_exists": os.path.exists(expected_path_structure["full_path_for_files"]),
            "background_path_exists": os.path.exists(background_task_path),
            "output_dir_from_db_exists": os.path.exists(os.path.join(settings.STORM_OUTPUT_DIR, db_run.output_dir)) if db_run.output_dir else False
        }
        
        # List bestanden
        files_found = {}
        if os.path.exists(background_task_path):
            try:
                files_found["background_task_path"] = os.listdir(background_task_path)
            except Exception as e:
                files_found["background_task_path"] = f"ERROR_LISTING: {str(e)}"
        
        if os.path.exists(expected_path_structure["full_path_for_files"]):
            try:
                files_found["expected_path"] = os.listdir(expected_path_structure["full_path_for_files"])
            except Exception as e:
                files_found["expected_path"] = f"ERROR_LISTING: {str(e)}"
        
        return {
            "run_info": {
                "id": db_run.id,
                "topic": db_run.topic,
                "owner_type": db_run.owner_type,
                "owner_id": db_run.owner_id,
                "status": str(db_run.status.value) if hasattr(db_run.status, 'value') else str(db_run.status),
                "output_dir_from_db": db_run.output_dir
            },
            "path_analysis": {
                "expected_structure": expected_path_structure,
                "background_task_path": background_task_path,
                "paths_exist": paths_exist,
                "files_found": files_found
            }
        }
    except Exception as e:
        import traceback
        return {
            "error": f"Debug endpoint error: {str(e)}",
            "traceback": traceback.format_exc()
        }

# --- User Endpoints ---
@users_router.post("/", response_model=schemas.User, status_code=status.HTTP_201_CREATED)
def create_new_user_registration(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    # Standaard rol voor self-registration is 'user'
    # schemas.UserCreate erft 'role' van UserBase, die 'user' als default heeft
    return crud.create_user(db=db, user=user)

@users_router.get("/me", response_model=schemas.User)
async def read_users_me(current_user: models.User = Depends(auth_core.get_current_active_admin)):
    """Get the current logged in user's information."""
    return current_user

# --- Authentication Endpoints ---
@auth_router.post("/login/access-token", response_model=schemas.Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)
):
    user = crud.get_user_by_email(db, email=form_data.username)
    if not user or not auth_core.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    # Payload aanpassen aan wat AuthContext.js en TokenData schema verwachten
    access_token_data = {
        "actor_id": user.id,
        "actor_email": user.email,
        "actor_type": "admin", # Expliciet "admin" voor admin login
        # Je kunt user.role hier ook nog toevoegen als dat nuttig is voor de frontend:
        "user_role": user.role 
    }
    access_token = auth_core.create_access_token(
        data=access_token_data, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

# --- Admin Endpoints ---
@admin_router.post("/users/", response_model=schemas.User, status_code=status.HTTP_201_CREATED)
def create_user_by_admin(user: schemas.UserCreate, db: Session = Depends(get_db)):
    """Admin endpoint to create a new user. Role can be specified in the request body."""
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    # De rol wordt direct uit het request (user: schemas.UserCreate) gehaald.
    # Als niet meegegeven in request, valt het terug op de default in UserCreate ('user')
    return crud.create_user(db=db, user=user)

@admin_router.get("/users/", response_model=List[schemas.User])
def read_users_by_admin(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Admin endpoint to retrieve all users."""
    users = crud.get_users(db, skip=skip, limit=limit)
    return users

@admin_router.get("/stats/overview", response_model=schemas.AdminDashboardStatsSchema)
async def get_dashboard_statistics(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_core.get_current_active_admin)
):
    """Admin endpoint to get an overview of system statistics (vouchers and admin runs)."""
    voucher_stats_orm = crud.get_voucher_statistics(db, limit=1000) # Krijgt List[models.Voucher]
    
    # Converteer voucher ORM objecten naar Pydantic schema objecten
    voucher_stats_list = [
        schemas.VoucherStatsSchema.model_validate(voucher) for voucher in voucher_stats_orm
    ]

    admin_run_stats_raw = crud.get_admin_user_run_counts(db) # Krijgt List[dict]
    
    # Converteer admin_run_stats dictionaries naar Pydantic schema objecten
    admin_run_stats_list = [
        schemas.AdminUserRunStatSchema(**stat) for stat in admin_run_stats_raw
    ]
    
    return schemas.AdminDashboardStatsSchema(
        voucher_stats=voucher_stats_list, 
        admin_run_stats=admin_run_stats_list
    )
    
# --- Admin Endpoints voor System Configuration ---
@admin_router.get("/system-configuration", response_model=schemas.SystemConfigurationResponse)
def read_system_configuration_endpoint(db: Session = Depends(get_db)):
    """
    Retrieve the current system-wide LLM and API configurations.
    If no configuration is set by an admin, it implies defaults from environment variables are used.
    """
    config = crud.get_system_configuration(db)
    return schemas.SystemConfigurationResponse(config=config)


@admin_router.put("/system-configuration", response_model=schemas.SystemConfigurationResponse)
def update_system_configuration_endpoint(
    config_update: schemas.SystemConfigurationUpdate, 
    db: Session = Depends(get_db)
):
    """
    Update system-wide LLM and API configurations.
    Only provide fields that need to be updated.
    """
    updated_config = crud.update_system_configuration(db=db, config_update=config_update)
    return schemas.SystemConfigurationResponse(config=updated_config)

# --- Storm Background Task ---
def run_storm_background(db: Session, run_id: int, topic: str, owner_type: str, owner_id: int):
    db_run = crud.get_storm_run(db, run_id=run_id)
    if not db_run:
        print(f"Error in background task: StormRun with id {run_id} not found.")
        return

    # Hoofdstatus naar running, stage naar INITIALIZING
    # Aanname: update_storm_run_status en update_storm_run_stage verwachten nu db_run
    db_run = crud.update_storm_run_status(db=db, db_run=db_run, status=models.StormRunStatus.running, current_stage="INITIALIZING")
    # crud.update_storm_run_stage(db=db, db_run=db_run, stage="INITIALIZING") # update_storm_run_status kan stage ook zetten

    user_specific_output_segment = os.path.join(str(db_run.owner_id), str(db_run.id)) # Gebruik db_run voor owner_id en id
    absolute_output_dir_for_storm_runner = os.path.join(settings.STORM_OUTPUT_DIR, user_specific_output_segment)
    
    try:
        os.makedirs(absolute_output_dir_for_storm_runner, exist_ok=True)
        db_run = crud.update_storm_run_status(db=db, db_run=db_run, status=models.StormRunStatus.running, current_stage="SETUP_COMPLETE")
        
        actual_runner_instance = get_storm_runner()

        if actual_runner_instance is None:
            error_message = "Failed to initialize Storm Runner: Required API key (e.g., OpenAI) might be missing or invalid. Please check system configuration."
            print(f"Error for run {db_run.id} (owner {db_run.owner_type} {db_run.owner_id}): {error_message}")
            # Aanname: update_storm_run_on_error verwacht nu db_run
            crud.update_storm_run_status(db=db, db_run=db_run, status=models.StormRunStatus.failed, current_stage="RUNNER_INIT_FAILED", error_message=error_message)
            return

        db_run = crud.update_storm_run_status(db=db, db_run=db_run, status=models.StormRunStatus.running, current_stage="RUNNER_INITIALIZED")
        actual_runner_instance.args.output_dir = absolute_output_dir_for_storm_runner
        
        db_run = crud.update_storm_run_status(db=db, db_run=db_run, status=models.StormRunStatus.running, current_stage="STORM_PROCESSING")
        actual_runner_instance.run(topic=db_run.topic) # Gebruik db_run.topic
        db_run = crud.update_storm_run_status(db=db, db_run=db_run, status=models.StormRunStatus.running, current_stage="STORM_PROCESSING_DONE")
        
        try:
            db_run = crud.update_storm_run_status(db=db, db_run=db_run, status=models.StormRunStatus.running, current_stage="POST_PROCESSING")
            actual_runner_instance.post_run()
            db_run = crud.update_storm_run_status(db=db, db_run=db_run, status=models.StormRunStatus.running, current_stage="POST_PROCESSING_DONE")
        except Exception as post_run_exc:
            import traceback
            post_run_error_msg = str(post_run_exc)
            post_run_tb_str = traceback.format_exc()
            print(f"Warning: Error during post_run for run {db_run.id} (owner {db_run.owner_type} {db_run.owner_id}): {post_run_error_msg}\\nTraceback: {post_run_tb_str}")
            db_run = crud.update_storm_run_status(db=db, db_run=db_run, status=models.StormRunStatus.running, current_stage="POST_PROCESSING_FAILED") # Status blijft running, maar stage geeft fout aan

        output_dir_to_db = user_specific_output_segment
        db_run = crud.update_storm_run_status(db=db, db_run=db_run, status=models.StormRunStatus.running, current_stage="FINALIZING")
        # Aanname: update_storm_run_on_completion verwacht nu db_run en output_dir is een veld ervan of apart
        # De functie update_storm_run_status handelt al completion statussen af (zet end_time, etc)
        db_run.output_dir = output_dir_to_db # Zet output_dir op het object
        crud.update_storm_run_status(db=db, db_run=db_run, status=models.StormRunStatus.completed) # current_stage wordt None gezet door update_storm_run_status
        
        # Increment voucher run count ONLY if the run completed successfully AND was owned by a voucher
        if db_run.status == models.StormRunStatus.completed and db_run.owner_type == "voucher":
            db_voucher = crud.get_voucher(db, voucher_id=db_run.owner_id) # Haal de voucher op
            if db_voucher:
                crud.increment_run_count(db=db, db_voucher=db_voucher)
                print(f"Successfully incremented run count for voucher {db_voucher.code} for completed run {db_run.id}")
            else:
                print(f"Warning: Could not find voucher with id {db_run.owner_id} to increment run count for completed run {db_run.id}")

        print(f"Storm run {db_run.id} for owner {db_run.owner_type} {db_run.owner_id} completed. Output in: {absolute_output_dir_for_storm_runner}")

    except Exception as e:
        if 'db_run' not in locals(): # Als db_run nog niet is opgehaald
            print(f"Critical error in background task before run object could be fetched for run_id {run_id}: {e}")
            return

        # Algemene foutafhandeling
        if 'actual_runner_instance' in locals() and actual_runner_instance is not None:
            import traceback
            error_msg = str(e)
            tb_str = traceback.format_exc()
            print(f"Error in Storm run {db_run.id} for owner {db_run.owner_type} {db_run.owner_id} (after runner init): {error_msg}\\nTraceback: {tb_str}")
            crud.update_storm_run_status(db=db, db_run=db_run, status=models.StormRunStatus.failed, error_message=f"Unexpected error: {error_msg} - See backend logs.")
        # Als de fout al was afgehandeld (zoals runner init failed), doe hier niets meer.

# --- Helper functie om een topic string naar een slug te converteren ---
def create_topic_slug(topic: str) -> str:
    return topic.lower().replace(" ", "_").replace("/", "_") # Vervang spaties en slashes

# --- Helper voor pad validatie ---
def get_safe_path(base_path: str, user_id: str, run_id: str, topic_slug: str, filename: str) -> str | None:
    # Bouw het verwachte pad op basis van de componenten
    # Voorkom dat run_id of user_id absolute paden worden of '..' bevatten
    if ".." in user_id or os.path.isabs(user_id) or \
       ".." in run_id or os.path.isabs(run_id) or \
       ".." in topic_slug or os.path.isabs(topic_slug): # Controleer topic_slug ook
        return None

    # Zorg ervoor dat de filename geen padcomponenten bevat
    if os.path.dirname(filename): # Als filename zoiets is als "subdir/file.txt"
        return None

    target_path = os.path.join(base_path, user_id, run_id, topic_slug, filename)
    
    # Normaliseer het pad (lost bijv. './' op) en controleer of het binnen de base_path valt
    # os.path.realpath lost symlinks op en normaliseert het pad
    normalized_target_path = os.path.realpath(target_path)
    normalized_base_path = os.path.realpath(base_path)

    if not normalized_target_path.startswith(normalized_base_path):
        return None # Path traversal poging
    
    if not os.path.exists(normalized_target_path) or not os.path.isfile(normalized_target_path):
        return None # Bestand bestaat niet of is geen bestand

    return normalized_target_path


# --- Storm Endpoints (nu beveiligd en user-scoped) ---
@storm_router.post("/run", response_model=schemas.StormRunJobResponse)
async def create_storm_run_endpoint(
    storm_request: schemas.StormRunCreate, 
    background_tasks: BackgroundTasks, 
    db: Session = Depends(get_db), 
    current_actor: Union[models.User, models.Voucher] = Depends(auth_core.get_current_actor)
):
    # Logic to determine owner_type and owner_id based on current_actor
    owner_type: str
    owner_id: int
    if isinstance(current_actor, models.User):
        owner_type = "user" # Of "admin" als je dat onderscheid wil maken voor eigenaarschap
        owner_id = current_actor.id
        # Hier zou je kunnen checken of de user wel een admin is als dat een vereiste is om runs te starten
        # if current_actor.role != "admin": 
        #     raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can start runs this way.")
    elif isinstance(current_actor, models.Voucher):
        if current_actor.used_runs >= current_actor.max_runs:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Voucher has no remaining runs."
            )
        # Increment run count for voucher - VERPLAATST NAAR BACKGROUND TASK
        # crud.increment_run_count(db=db, db_voucher=current_actor) 
        owner_type = "voucher"
        owner_id = current_actor.id
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid actor type for starting a run.")

    new_run = crud.create_storm_run(db=db, run_in=storm_request, owner_type=owner_type, owner_id=owner_id)
    
    # De run_storm_background functie verwacht nu owner_type en owner_id apart
    # en output_dir wordt intern in crud.create_storm_run gezet.
    background_tasks.add_task(
        run_storm_background, 
        db=db, 
        run_id=new_run.id, 
        topic=new_run.topic, 
        owner_type=owner_type, 
        owner_id=owner_id,
        # user_id is niet meer direct nodig als owner_id en owner_type er zijn.
        # De background task moet ook aangepast worden om dit te reflecteren.
    )
    return {
        "message": f"Storm run for topic '{new_run.topic}' initiated successfully for {owner_type} {owner_id}.",
        "job_id": new_run.id, 
        "topic": new_run.topic, 
        "status": new_run.status, 
        "start_time": new_run.start_time
    }

@storm_router.get("/status/{job_id}", response_model=schemas.StormRunStatusResponse)
async def get_storm_run_status(
    job_id: int, 
    db: Session = Depends(get_db), 
    current_actor: Union[models.User, models.Voucher] = Depends(auth_core.get_current_actor_or_inactive_for_history)
):
    # Logic to check if current_actor is authorized to see this job_id
    db_run = crud.get_storm_run(db, run_id=job_id) # Haal eerst de run op
    if not db_run:
        raise HTTPException(status_code=404, detail="Storm run not found")

    if isinstance(current_actor, models.User): # Admin
        # Admin mag elke status zien (of specifieke permissies)
        pass 
    elif isinstance(current_actor, models.Voucher): # Voucher
        if db_run.owner_type != "voucher" or db_run.owner_id != current_actor.id:
            raise HTTPException(status_code=403, detail="Not authorized to view this storm run status")
    else:
        raise HTTPException(status_code=403, detail="Invalid actor type for viewing status")
    
    return schemas.StormRunStatusResponse(
        job_id=db_run.id,
        status=db_run.status,
        current_stage=db_run.current_stage,
        topic=db_run.topic,
        start_time=db_run.start_time,
        end_time=db_run.end_time,
        output_dir=db_run.output_dir, # Let op: output_dir kan gevoelige info bevatten, afschermen indien nodig
        error_message=db_run.error_message
    )

@storm_router.get("/history", response_model=List[schemas.StormRun])
async def get_storm_run_history(
    db: Session = Depends(get_db),
    current_actor: Union[models.User, models.Voucher] = Depends(auth_core.get_current_actor_or_inactive_for_history),
    skip: int = 0,
    limit: int = 100
) -> list[schemas.StormRun]:
    runs = []
    if isinstance(current_actor, models.User): # Admin User
        # Voor nu: admin ziet alleen eigen runs, net als voorheen. 
        # Om ALLE runs te zien, gebruik /history/all (die get_current_active_admin behoudt)
        runs = crud.get_storm_runs_for_owner(db, owner_type="user", owner_id=current_actor.id, skip=skip, limit=limit)
    elif isinstance(current_actor, models.Voucher):
        runs = crud.get_storm_runs_for_owner(db, owner_type="voucher", owner_id=current_actor.id, skip=skip, limit=limit)
    else:
        # Dit zou niet moeten gebeuren als get_current_actor correct werkt
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized actor type for history")
    return runs

@storm_router.get("/history/all", response_model=list[schemas.StormRun], dependencies=[Depends(auth_core.get_current_active_admin)])
async def get_all_storm_run_history_for_admin(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100
) -> list[schemas.StormRun]:
    """
    Retrieve all storm run history. 
    Only accessible to admins (enforced by dependency).
    """
    runs = crud.get_all_storm_runs_for_admin(db, skip=skip, limit=limit)
    return runs

@storm_router.get("/results/{job_id}/summary") # Geeft nu JSON terug, niet FileResponse
async def get_storm_run_summary_json(
    job_id: int, 
    db: Session = Depends(get_db), 
    current_actor: Union[models.User, models.Voucher] = Depends(auth_core.get_current_actor_or_inactive_for_history)
):
    run = crud.get_storm_run(db, run_id=job_id)
    if not run or not run.output_dir or not run.topic:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found, not completed, output directory or topic missing")

    summary_filename = "url_to_info.json"
    topic_slug = create_topic_slug(run.topic)
    file_path = get_safe_path(settings.STORM_OUTPUT_DIR, str(run.owner_id), str(run.id), topic_slug, summary_filename)

    if not file_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{summary_filename} not found for run {job_id}")
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        sources_list = []
        # Determine the correct dictionary to iterate for sources.
        # If data["url_to_info"] exists and is a dictionary, assume it's the actual source map.
        # Otherwise, use the top-level 'data' object (original behavior).
        map_to_iterate = data
        if isinstance(data.get("url_to_info"), dict):
            map_to_iterate = data["url_to_info"]
        
        # Ensure map_to_iterate is a dictionary before trying to call .items()
        if isinstance(map_to_iterate, dict):
            for index, (url, info) in enumerate(map_to_iterate.items()):
                title = "N/A"
                # Ensure 'info' is a dictionary to safely call .get("title")
                if isinstance(info, dict):
                    title = info.get("title", "N/A")
                
                sources_list.append({
                    "index": index + 1,
                    "title": title,
                    "url": url  # The key of map_to_iterate is assumed to be the URL
                })
        elif isinstance(data, list): # Handle case where data itself is a list of sources
            # This case might occur if url_to_info.json is an array of objects,
            # each with 'url' and 'title'.
            for index, item in enumerate(data):
                if isinstance(item, dict):
                    sources_list.append({
                        "index": index + 1,
                        "title": item.get("title", "N/A"),
                        "url": item.get("url", "N/A")
                    })
        
        # If sources_list is empty here and the original data was a dict, 
        # it implies the structure was not as expected by either path.
        # Logging data structure might be useful for further debugging if issues persist.
        # Example: if len(sources_list) == 0 and isinstance(data, dict):
        #    print(f"Warning: Could not parse sources from data: {data}")

        return sources_list
    except FileNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{summary_filename} not found")
    except json.JSONDecodeError:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error decoding {summary_filename}")


@storm_router.get("/results/{job_id}/outline")
async def get_storm_run_outline_file(
    job_id: int, 
    db: Session = Depends(get_db), 
    current_actor: Union[models.User, models.Voucher] = Depends(auth_core.get_current_actor_or_inactive_for_history)
):
    run = crud.get_storm_run(db, run_id=job_id)
    if not run or not run.output_dir or not run.topic:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found, not completed, output directory or topic missing")

    possible_filenames = ["storm_gen_outline.txt", "direct_gen_outline.txt"]
    file_path_to_serve = None
    topic_slug = create_topic_slug(run.topic)

    for filename in possible_filenames:
        file_path = get_safe_path(settings.STORM_OUTPUT_DIR, str(run.owner_id), str(run.id), topic_slug, filename)
        if file_path:
            file_path_to_serve = file_path
            break
            
    if not file_path_to_serve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Outline file not found for run {job_id}")
    
    return Response(content=open(file_path_to_serve, 'r', encoding='utf-8').read(), media_type="text/plain")


@storm_router.get("/results/{job_id}/article")
async def get_storm_run_article_file(
    job_id: int, 
    db: Session = Depends(get_db), 
    current_actor: Union[models.User, models.Voucher] = Depends(auth_core.get_current_actor_or_inactive_for_history)
):
    run = crud.get_storm_run(db, run_id=job_id)
    if not run or not run.output_dir or not run.topic:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found, not completed, output directory or topic missing")

    article_filename = "storm_gen_article_polished.txt"
    topic_slug = create_topic_slug(run.topic)
    file_path = get_safe_path(settings.STORM_OUTPUT_DIR, str(run.owner_id), str(run.id), topic_slug, article_filename)

    if not file_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{article_filename} not found for run {job_id}")
        
    return Response(content=open(file_path, 'r', encoding='utf-8').read(), media_type="text/markdown")


@storm_router.delete("/run/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_storm_run_endpoint(
    job_id: int, 
    db: Session = Depends(get_db), 
    current_actor: Union[models.User, models.Voucher] = Depends(auth_core.get_current_actor)
):
    run_to_delete = crud.get_storm_run(db, run_id=job_id)
    if not run_to_delete:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")

    # Determine owner_type and owner_id from the run_to_delete object itself,
    # as current_actor might be an admin deleting someone else's run (if allowed by business logic later).
    # For now, we strictly check if current_actor is the owner.

    can_delete = False
    owner_type_for_crud: str = ""
    owner_id_for_crud: int = 0

    if isinstance(current_actor, models.User):
        # Assuming admin can delete any run. If admins can only delete their own runs, 
        # this logic needs to match owner_type="user" and owner_id=current_actor.id
        # For now, if it's an admin, we fetch the details from the run to be deleted.
        # However, the crud.delete_storm_run_by_admin might be more appropriate if it exists and is used.
        # The current error implies crud.delete_storm_run is called, which needs owner_type/id.
        # Let's assume admin can delete any run, and we use the run's own owner details for the specific delete.
        # This means an admin is deleting on behalf of the owner technically for the CRUD below.
        # This part might need refinement based on whether admins bypass owner checks in CRUD.
        # For a voucher user, it must be their own run.
        
        # If an admin is deleting, and delete_storm_run requires owner_type and owner_id of the run itself:
        owner_type_for_crud = run_to_delete.owner_type
        owner_id_for_crud = run_to_delete.owner_id
        can_delete = True # Admins can delete any run

    elif isinstance(current_actor, models.Voucher):
        if run_to_delete.owner_type == "voucher" and run_to_delete.owner_id == current_actor.id:
            owner_type_for_crud = "voucher"
            owner_id_for_crud = current_actor.id
            can_delete = True
        else:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this run")
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid actor type for deletion")

    if not can_delete:
        # This case should ideally be caught by the logic above, but as a fallback:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Deletion not permitted for this actor and run combination.")

    # Verwijder de output directory als deze bestaat en een pad heeft
    if run_to_delete.output_dir:
        dir_to_delete = os.path.join(settings.STORM_OUTPUT_DIR, str(run_to_delete.owner_id), str(run_to_delete.id))
        normalized_base_dir = os.path.realpath(settings.STORM_OUTPUT_DIR)
        normalized_dir_to_delete = os.path.realpath(dir_to_delete)

        if normalized_dir_to_delete.startswith(normalized_base_dir) and \
           normalized_dir_to_delete != normalized_base_dir and \
           os.path.exists(normalized_dir_to_delete):
            try:
                shutil.rmtree(normalized_dir_to_delete)
                print(f"Deleted output directory for run: {normalized_dir_to_delete}")
                user_dir_path = os.path.dirname(normalized_dir_to_delete)
                if user_dir_path.startswith(normalized_base_dir) and user_dir_path != normalized_base_dir:
                    if not os.listdir(user_dir_path):
                        try:
                            os.rmdir(user_dir_path)
                            print(f"Deleted empty user directory: {user_dir_path}")
                        except OSError as e:
                            print(f"Error deleting empty user directory {user_dir_path}: {e.strerror}")
                    else:
                        print(f"User directory {user_dir_path} is not empty, not deleting.")
            except OSError as e:
                print(f"Error deleting directory {normalized_dir_to_delete}: {e.strerror}")
        else:
            print(f"Skipped deleting directory: {dir_to_delete} (Path issue or not found)")
            
    # Perform the delete operation using the determined owner_type and owner_id
    deleted_run_db_obj = crud.delete_storm_run(db=db, run_id=job_id, owner_type=owner_type_for_crud, owner_id=owner_id_for_crud)
    
    if not deleted_run_db_obj:
        # This might happen if the run was already deleted by another process, or if owner details didn't match
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found or deletion failed in CRUD operation")

    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Routers toevoegen aan de app ---
# Belangrijk: de volgorde kan uitmaken als je path overlaps hebt, maar hier niet direct het geval.
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(login_api_router.router, prefix=settings.API_V1_STR)
app.include_router(users_router, prefix=settings.API_V1_STR)
app.include_router(admin_router, prefix=settings.API_V1_STR)
app.include_router(storm_router, prefix=settings.API_V1_STR)
app.include_router(debug_router, prefix=settings.API_V1_STR)
app.include_router(vouchers_endpoint_router.router, prefix=f"{settings.API_V1_STR}/vouchers", tags=["Vouchers"])

# Als laatste redmiddel, voor endpoints die nergens matchen (kan helpen bij debuggen)
# @app.api_route("/{path_name:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
# async def catch_all(path_name: str):
#     raise HTTPException(status_code=404, detail=f"Endpoint /{path_name} not found.") 