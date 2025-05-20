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
from typing import TYPE_CHECKING, Optional, List
import json
import shutil # Toegevoegd voor map verwijderen

from .core.config import settings
from .database import engine, Base, get_db
from . import models, schemas, crud, security
from .storm_runner import get_storm_runner, STORMWikiRunner # Importeer ook Runner voor type hint
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
    # Controleer of models.Base bestaat en attributen heeft voordat create_all wordt aangeroepen
    if hasattr(models, 'Base') and hasattr(models.Base, 'metadata'):
        models.Base.metadata.create_all(bind=engine)
    else:
        print("Skipping database creation: models.Base or models.Base.metadata not found.")
        # Je zou hier specifiekere logging of error handling kunnen toevoegen


@app.get("/")
async def read_root():
    return {"message": f"Welcome to {settings.APP_NAME}"}

# --- APIRouters ---
auth_router = APIRouter(tags=["Authentication"])
users_router = APIRouter(prefix="/users", tags=["Users"])
admin_router = APIRouter(prefix="/admin", tags=["Admin"], dependencies=[Depends(security.get_current_active_admin)])
storm_router = APIRouter(prefix="/storm", tags=["Storm"])

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
async def read_users_me(current_user: models.User = Depends(security.get_current_active_user)):
    """Get the current logged in user's information."""
    return current_user

# --- Authentication Endpoints ---
@auth_router.post("/token", response_model=schemas.Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)
):
    user = crud.get_user_by_email(db, email=form_data.username)
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    # BELANGRIJK: Geef de role mee aan de token data
    access_token_data = {"sub": user.email, "role": user.role}
    access_token = security.create_access_token(
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

@admin_router.get("/stats/runs_per_user", response_model=List[schemas.UserRunStats])
def get_run_stats_per_user_by_admin(db: Session = Depends(get_db)):
    """Admin endpoint to get run statistics per user."""
    stats = crud.get_run_count_per_user(db)
    # Converteer naar UserRunStats schema
    user_run_stats_list = []
    for stat_item in stats: # Iterate over each dictionary in the list
        user_run_stats_list.append(schemas.UserRunStats(
            user_id=stat_item['user_id'], 
            email=stat_item['email'], 
            role=stat_item['role'], 
            run_count=stat_item['run_count']
        ))
    return user_run_stats_list
    
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
def run_storm_background(db: Session, run_id: int, topic: str, user_id: int):
    # Hoofdstatus naar running, stage naar INITIALIZING
    crud.update_storm_run_status(db=db, run_id=run_id, status="running", user_id=user_id)
    crud.update_storm_run_stage(db=db, run_id=run_id, stage="INITIALIZING", user_id=user_id)

    user_specific_output_segment = os.path.join(str(user_id), str(run_id))
    absolute_output_dir_for_storm_runner = os.path.join(settings.STORM_OUTPUT_DIR, user_specific_output_segment)
    
    try:
        os.makedirs(absolute_output_dir_for_storm_runner, exist_ok=True)
        crud.update_storm_run_stage(db=db, run_id=run_id, stage="SETUP_COMPLETE", user_id=user_id)
        
        actual_runner_instance = get_storm_runner() # Deze kan None retourneren als keys missen

        if actual_runner_instance is None:
            # Specifieke foutafhandeling als runner initialisatie faalt (bv. API keys missen)
            error_message = "Failed to initialize Storm Runner: Required API key (e.g., OpenAI) might be missing or invalid. Please check system configuration."
            print(f"Error for run {run_id} (user {user_id}): {error_message}")
            crud.update_storm_run_stage(db=db, run_id=run_id, stage="RUNNER_INIT_FAILED", user_id=user_id)
            crud.update_storm_run_on_error(db=db, run_id=run_id, error_message=error_message, user_id=user_id)
            return # Stop executie van deze background task
            
        crud.update_storm_run_stage(db=db, run_id=run_id, stage="RUNNER_INITIALIZED", user_id=user_id)
        actual_runner_instance.args.output_dir = absolute_output_dir_for_storm_runner
        
        crud.update_storm_run_stage(db=db, run_id=run_id, stage="STORM_PROCESSING", user_id=user_id)
        actual_runner_instance.run(topic=topic)
        crud.update_storm_run_stage(db=db, run_id=run_id, stage="STORM_PROCESSING_DONE", user_id=user_id)
        
        try:
            crud.update_storm_run_stage(db=db, run_id=run_id, stage="POST_PROCESSING", user_id=user_id)
            actual_runner_instance.post_run()
            crud.update_storm_run_stage(db=db, run_id=run_id, stage="POST_PROCESSING_DONE", user_id=user_id)
        except Exception as post_run_exc:
            import traceback
            post_run_error_msg = str(post_run_exc)
            post_run_tb_str = traceback.format_exc()
            print(f"Warning: Error during post_run for run {run_id} (user {user_id}): {post_run_error_msg}\nTraceback: {post_run_tb_str}")
            crud.update_storm_run_stage(db=db, run_id=run_id, stage="POST_PROCESSING_FAILED", user_id=user_id)

        output_dir_to_db = user_specific_output_segment
        crud.update_storm_run_stage(db=db, run_id=run_id, stage="FINALIZING", user_id=user_id)
        crud.update_storm_run_on_completion(db=db, run_id=run_id, status="completed", output_dir=output_dir_to_db, user_id=user_id)
        print(f"Storm run {run_id} for user {user_id} completed. Output in: {absolute_output_dir_for_storm_runner}")

    except Exception as e: 
        # Algemene foutafhandeling voor onverwachte errors tijdens de run
        # Als het niet al de runner initialisatie fout was.
        if 'actual_runner_instance' in locals() and actual_runner_instance is not None: 
            import traceback
            error_msg = str(e)
            tb_str = traceback.format_exc()
            print(f"Error in Storm run {run_id} for user {user_id} (after runner init): {error_msg}\\nTraceback: {tb_str}")
            # De stage kan hier al een specifieke fout aangeven, of nog op een processing stage staan
            # crud.update_storm_run_stage(db=db, run_id=run_id, stage="UNEXPECTED_ERROR", user_id=user_id) # Optioneel
            crud.update_storm_run_on_error(db=db, run_id=run_id, error_message=f"Unexpected error: {error_msg} - See backend logs.", user_id=user_id)
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
    current_user: models.User = Depends(security.get_current_active_user)
):
    new_run = crud.create_storm_run(db=db, topic=storm_request.topic, user_id=current_user.id)
    background_tasks.add_task(run_storm_background, db, new_run.id, storm_request.topic, current_user.id)
    return {
        "message": f"Storm run for topic '{new_run.topic}' initiated successfully.",
        "job_id": new_run.id, 
        "topic": new_run.topic, 
        "status": new_run.status, 
        "start_time": new_run.start_time
    }

@storm_router.get("/status/{job_id}", response_model=schemas.StormRunStatusResponse)
async def get_storm_run_status(
    job_id: int, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(security.get_current_active_user)
):
    """Get the status of a specific Storm run."""
    is_admin_check = current_user.role == "admin"
    db_run = crud.get_storm_run(db, run_id=job_id, user_id=current_user.id, is_admin=is_admin_check)
    if not db_run:
        raise HTTPException(status_code=404, detail="Storm run not found or not owned by user")
    
    # Summary en article content hier niet laden, dat zijn aparte endpoints
    return schemas.StormRunStatusResponse(
        job_id=db_run.id,
        status=db_run.status,
        current_stage=db_run.current_stage, # Voeg current_stage toe aan de response
        topic=db_run.topic,
        start_time=db_run.start_time,
        end_time=db_run.end_time,
        output_dir=db_run.output_dir,
        error_message=db_run.error_message
    )

@storm_router.get("/history", response_model=List[schemas.StormRunHistoryItem])
async def get_storm_run_history(
    skip: int = 0, limit: int = 20, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(security.get_current_active_user)
):
    runs = crud.get_storm_runs_by_user(db, user_id=current_user.id, skip=skip, limit=limit)
    return runs

@storm_router.get("/results/{job_id}/summary") # Geeft nu JSON terug, niet FileResponse
async def get_storm_run_summary_json(
    job_id: int, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(security.get_current_active_user)
):
    run = crud.get_storm_run(db, run_id=job_id, user_id=current_user.id, is_admin=current_user.role == 'admin')
    if not run or not run.output_dir or not run.topic:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found, not completed, output directory or topic missing")

    summary_filename = "url_to_info.json"
    topic_slug = create_topic_slug(run.topic)
    file_path = get_safe_path(settings.STORM_OUTPUT_DIR, str(run.user_id), str(run.id), topic_slug, summary_filename)

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
    current_user: models.User = Depends(security.get_current_active_user)
):
    run = crud.get_storm_run(db, run_id=job_id, user_id=current_user.id, is_admin=current_user.role == 'admin')
    if not run or not run.output_dir or not run.topic:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found, not completed, output directory or topic missing")

    possible_filenames = ["storm_gen_outline.txt", "direct_gen_outline.txt"]
    file_path_to_serve = None
    topic_slug = create_topic_slug(run.topic)

    for filename in possible_filenames:
        file_path = get_safe_path(settings.STORM_OUTPUT_DIR, str(run.user_id), str(run.id), topic_slug, filename)
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
    current_user: models.User = Depends(security.get_current_active_user)
):
    run = crud.get_storm_run(db, run_id=job_id, user_id=current_user.id, is_admin=current_user.role == 'admin')
    if not run or not run.output_dir or not run.topic:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found, not completed, output directory or topic missing")

    article_filename = "storm_gen_article_polished.txt"
    topic_slug = create_topic_slug(run.topic)
    file_path = get_safe_path(settings.STORM_OUTPUT_DIR, str(run.user_id), str(run.id), topic_slug, article_filename)

    if not file_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{article_filename} not found for run {job_id}")
        
    return Response(content=open(file_path, 'r', encoding='utf-8').read(), media_type="text/markdown")


@storm_router.delete("/run/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_storm_run_endpoint(
    job_id: int, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(security.get_current_active_user)
):
    run_to_delete = crud.get_storm_run(db, run_id=job_id, user_id=current_user.id, is_admin=current_user.role == 'admin')
    if not run_to_delete:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found or not authorized to delete")

    # Verwijder de output directory als deze bestaat en een pad heeft
    if run_to_delete.output_dir:
        # run_to_delete.output_dir is user_id/run_id
        # We moeten dit combineren met settings.STORM_OUTPUT_DIR
        dir_to_delete = os.path.join(settings.STORM_OUTPUT_DIR, str(run_to_delete.user_id), str(run_to_delete.id))
        # Extra veiligheidscheck: zorg dat we niet de root output dir verwijderen
        # en dat het pad daadwerkelijk overeenkomt met wat we verwachten te verwijderen.
        normalized_base_dir = os.path.realpath(settings.STORM_OUTPUT_DIR)
        normalized_dir_to_delete = os.path.realpath(dir_to_delete)

        if normalized_dir_to_delete.startswith(normalized_base_dir) and \
           normalized_dir_to_delete != normalized_base_dir and \
           os.path.exists(normalized_dir_to_delete):
            try:
                shutil.rmtree(normalized_dir_to_delete)
                print(f"Deleted output directory for run: {normalized_dir_to_delete}")

                # Check if the parent user directory (e.g., storm_output/<user_id>/) is now empty
                user_dir_path = os.path.dirname(normalized_dir_to_delete)
                # Make sure user_dir_path is still within STORM_OUTPUT_DIR and not STORM_OUTPUT_DIR itself
                if user_dir_path.startswith(normalized_base_dir) and user_dir_path != normalized_base_dir:
                    if not os.listdir(user_dir_path): # Check if empty
                        try:
                            os.rmdir(user_dir_path)
                            print(f"Deleted empty user directory: {user_dir_path}")
                        except OSError as e:
                            print(f"Error deleting empty user directory {user_dir_path}: {e.strerror}")
                    else:
                        print(f"User directory {user_dir_path} is not empty, not deleting.")

            except OSError as e:
                print(f"Error deleting directory {normalized_dir_to_delete}: {e.strerror}")
                # Niet fatale fout, ga door met verwijderen uit DB
        else:
            print(f"Skipped deleting directory: {dir_to_delete} (Path issue or not found)")
            
    crud.delete_storm_run(db=db, run_id=job_id, user_id=current_user.id, is_admin=current_user.role == 'admin')
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Routers toevoegen aan de app ---
# Belangrijk: de volgorde kan uitmaken als je path overlaps hebt, maar hier niet direct het geval.
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(admin_router)
app.include_router(storm_router)

# Als laatste redmiddel, voor endpoints die nergens matchen (kan helpen bij debuggen)
# @app.api_route("/{path_name:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
# async def catch_all(path_name: str):
#     raise HTTPException(status_code=404, detail=f"Endpoint /{path_name} not found.") 