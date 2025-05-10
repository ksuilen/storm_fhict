from fastapi import FastAPI, Depends, HTTPException, status, BackgroundTasks, Response
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
from typing import TYPE_CHECKING, Optional
import json

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
    openapi_components={"securitySchemes": {"BearerAuth": bearer_auth_scheme}},
    # Vertel Swagger UI om deze scheme te gebruiken voor de globale Authorize knop
    security=[{"BearerAuth": []}]
)

# --- CORS Middleware --- 
# Voeg dit toe VOORDAT je routes definieert
origins = [
    "http://localhost:3000", # De origin van je React frontend development server
    # Voeg hier eventueel andere origins toe (bv. je productie frontend URL)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True, # Sta credentials (zoals cookies, authorization headers) toe
    allow_methods=["*"],    # Sta alle methodes toe (GET, POST, etc.)
    allow_headers=["*"],    # Sta alle headers toe
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

# --- User Endpoints ---
@app.post("/users/", response_model=schemas.User)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    return crud.create_user(db=db, user=user)

# --- Beveiligd Endpoint Voorbeeld ---
@app.get(
    "/users/me", 
    response_model=schemas.User,
    # We hoeven hier niks extra's te specificeren voor security docs,
    # de globale setting en de Depends() regelen het.
)
async def read_users_me(current_user: models.User = Depends(security.get_current_active_user)):
    """Get the current logged in user's information."""
    return current_user

# --- Authentication Endpoints ---

@app.post("/token", response_model=schemas.Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)
):
    user = crud.get_user_by_email(db, email=form_data.username) # Use email as username
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

# Add other endpoints later 

# Background task for running Storm
def run_storm_background(db: Session, run_id: int, topic: str, user_id: int):
    # run_id is de UUID van de StormRun record, user_id is de ID van de User record.
    crud.update_storm_run(db=db, run_id=run_id, status="running")
    
    # Het pad relatief aan BASE_STORM_OUTPUT_DIR, dat we opslaan in de DB.
    # run_id is al een UUID string vanuit het model, dus str() is mogelijk niet strikt nodig,
    # maar voor de zekerheid en consistentie.
    user_specific_output_segment = os.path.join(str(user_id), str(run_id))
    
    # Het volledige absolute pad waar storm_runner zijn output moet schrijven.
    # settings.STORM_OUTPUT_DIR is bijv. "backend/storm_output" of "./storm_output"
    # Als het "./storm_output" is, en de app draait vanuit storm_webapp/backend, dan is dit correct.
    # Als de app draait vanuit storm_webapp, dan moet settings.STORM_OUTPUT_DIR "backend/storm_output" zijn.
    # We gaan ervan uit dat settings.STORM_OUTPUT_DIR correct is geconfigureerd.
    absolute_output_dir_for_storm_runner = os.path.join(settings.STORM_OUTPUT_DIR, user_specific_output_segment)
    
    try:
        # Zorg ervoor dat de output directory bestaat
        os.makedirs(absolute_output_dir_for_storm_runner, exist_ok=True)
        print(f"Ensured output directory exists: {absolute_output_dir_for_storm_runner}") # Logging

        # Parameters voor de Storm run
        # Let op: storm_runner is de module, niet een instance hier. We roepen de run_storm functie direct aan.
        # We moeten de get_storm_runner dependency hier op een andere manier verkrijgen of direct initialiseren.
        # Voor nu, ga ik ervan uit dat storm_runner.run_storm direct aangeroepen kan worden
        # en dat het de nodige configuratie intern laadt.
        
        # De aanroep naar storm_runner.run_storm moet worden aangepast
        # om de 'output_dir_to_use' of een vergelijkbare parameter te accepteren.
        # De huidige storm_runner.run_storm in het bestand accepteert user_id, topic, params.
        # We moeten dit uitbreiden of de params object gebruiken.
        # Voor nu, voeg ik het toe als een nieuwe parameter, en storm_runner.py moet worden aangepast.

        # Initialiseer de runner hier expliciet, omdat we niet in een HTTP request context zitten
        # waar FastAPI Depends() werkt.
        try:
            actual_runner_instance = get_storm_runner() # settings is globaal in storm_runner.py
            if actual_runner_instance is None:
                raise Exception("Failed to initialize Storm Runner for background task.")
        except Exception as runner_init_ex:
            print(f"Error initializing Storm Runner in background task: {runner_init_ex}")
            raise # Her-raise de exception om de run als mislukt te markeren

        # Construct StormRunParameters, nu met de output directory
        # De StormRunParameters class in storm_runner.py moet 'output_dir' accepteren
        storm_params_dict = {
            'do_research_online': True, 'do_generate_outline': True,
            'do_generate_article': True, 'do_polish_article': True,
            'do_generate_presentation': False,
            'output_dir': absolute_output_dir_for_storm_runner # Geef het volledige pad hier mee
        }
        # Verwijder None waarden zodat default waarden in Pydantic model gebruikt kunnen worden
        storm_params_dict = {k: v for k, v in storm_params_dict.items() if v is not None}
        storm_params = actual_runner_instance.StormRunParameters(**storm_params_dict)
        
        print(f"Calling storm_runner.run_storm with topic='{topic}', output_dir='{absolute_output_dir_for_storm_runner}' for user_id='{user_id}', run_id='{run_id}'")

        # De run_storm functie in storm_runner.py moet worden aangepast om params te accepteren
        # en de output_dir daaruit te gebruiken.
        # Het huidige run_storm in storm_runner.py roept runner.run() aan.
        # We moeten ervoor zorgen dat de runner instance in run_storm de output_dir gebruikt.
        # Mogelijk is het beter om de runner instance direct te gebruiken
        actual_runner_instance.run(
            topic=topic,
            # De parameters komen nu van het storm_params object
            # Dit vereist dat de .run() methode van STORMWikiRunner ook output_dir uit zijn args haalt.
            # STORMWikiRunner (in knowledge-storm) gebruikt self.args.output_dir.
            # We moeten zorgen dat dit correct wordt ingesteld.
            # De StormRunParameters (als het de Pydantic model is) zal output_dir bevatten.
            # De constructor van STORMWikiRunner in get_storm_runner moet dit mogelijk overnemen.

            # De eenvoudigste manier is om de output_dir in de runner's args te zetten
            # voordat .run() wordt aangeroepen, als STORMWikiRunner het daaruit leest.
            # Of de .run() methode zelf accepteert een output_dir.
            # Uit de oude synchrone endpoint: runner.run(topic=...) en runner.args.output_dir werd gebruikt.
            # Dus, we moeten runner.args.output_dir instellen.
            # StormRunParameters wordt typisch gebruikt om runner.args te initialiseren.
        )
        actual_runner_instance.args.output_dir = absolute_output_dir_for_storm_runner # Stel expliciet in als de runner dit gebruikt
        actual_runner_instance.run(topic=topic) # Roep .run() aan, het zou nu de juiste output_dir moeten gebruiken

        # Na de run, post-processing en summary
        actual_runner_instance.post_run()
        run_summary = actual_runner_instance.summary() # Dit kan een dict of een string zijn

        # Sla de summary op als JSON in de output directory
        summary_filename = "storm_summary.json"
        summary_filepath = os.path.join(absolute_output_dir_for_storm_runner, summary_filename)
        with open(summary_filepath, 'w', encoding='utf-8') as f_summary:
            json.dump(run_summary, f_summary, indent=4)
        
        # De output_dir die we in de DB opslaan is het relatieve segment
        output_dir_to_db = user_specific_output_segment
        final_status = "completed"
        error_msg_final = None
        print(f"Storm run {run_id} for user {user_id} completed. Output in: {absolute_output_dir_for_storm_runner}")

    except Exception as e:
        import traceback
        print(f"ERROR during Storm run_storm_background for run_id {run_id}, user_id {user_id}: {e}")
        traceback.print_exc()
        output_dir_to_db = None # Geen valide output dir bij error
        error_msg_final = str(e)
        final_status = "failed"
    finally:
        crud.update_storm_run(db=db, run_id=run_id, status=final_status, 
                              end_time=datetime.utcnow(), output_dir=output_dir_to_db,
                              error_message=error_msg_final)

# BASE_RESULTS_PATH = "." # Deze variabele is niet meer nodig als we settings.STORM_OUTPUT_DIR gebruiken.
# Verwijder of commentarieer BASE_RESULTS_PATH

def get_safe_path(base_path: str, unsafe_path_segment: str, filename: str) -> str | None:
    # Valideer base_path: zorg dat het een bekende, veilige root is.
    # settings.STORM_OUTPUT_DIR is onze "veilige" root.
    # We moeten ervoor zorgen dat base_path hier altijd mee overeenkomt of eronder valt.
    # Echter, get_safe_path wordt nu direct aangeroepen met settings.STORM_OUTPUT_DIR als base_path.
    
    if not unsafe_path_segment or ".." in unsafe_path_segment or unsafe_path_segment.startswith("/"):
        print(f"get_safe_path: Unsafe path segment detected: '{unsafe_path_segment}'")
        return None
    
    # Construeer het volledige pad
    # base_path is bijv. "backend/storm_output"
    # unsafe_path_segment is bijv. "USER_ID/RUN_ID"
    # filename is bijv. "storm_summary.json"
    # full_path wordt dan "backend/storm_output/USER_ID/RUN_ID/storm_summary.json"
    full_path = os.path.join(base_path, unsafe_path_segment, filename)
    
    # Normaliseer het pad (lost ., .., etc. op)
    normalized_path = os.path.normpath(full_path)
    
    # Controleer of het genormaliseerde pad nog steeds begint met de (genormaliseerde) base_path.
    # Dit is een cruciale check tegen path traversal.
    # os.path.abspath kan hier helpen om absolute paden te vergelijken.
    abs_base_path = os.path.abspath(base_path)
    abs_normalized_path = os.path.abspath(normalized_path)

    if not abs_normalized_path.startswith(abs_base_path + os.sep) and abs_normalized_path != abs_base_path : # os.sep voor subdirectories
        print(f"get_safe_path: Path traversal attempt detected. Normalized path '{abs_normalized_path}' is not under base path '{abs_base_path}'")
        return None
        
    if not os.path.exists(normalized_path) or not os.path.isfile(normalized_path):
        print(f"get_safe_path: File does not exist or is not a file: '{normalized_path}'")
        return None
        
    return normalized_path

@app.post("/storm/run", response_model=schemas.StormRunJobResponse)
async def create_storm_run_endpoint(storm_request: schemas.StormRunCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_active_user)):
    db_storm_run = crud.create_storm_run(db=db, run=storm_request, user_id=current_user.id)
    background_tasks.add_task(run_storm_background, db=db, run_id=db_storm_run.id, topic=storm_request.topic, user_id=current_user.id)
    return schemas.StormRunJobResponse(message="Storm run initiated.", job_id=db_storm_run.id, topic=db_storm_run.topic, status=db_storm_run.status, start_time=db_storm_run.start_time)

@app.get("/storm/status/{job_id}", response_model=schemas.StormRunStatusResponse)
async def get_storm_run_status(job_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_active_user)):
    db_run = crud.get_storm_run(db=db, run_id=job_id, user_id=current_user.id)
    if not db_run:
        raise HTTPException(status_code=404, detail="Storm run not found or not authorized")
    # Potentially enrich with summary/article if completed and files exist
    summary_content = None
    article_preview = None # Not sending full article here, just a preview or confirmation
    if db_run.status == "completed" and db_run.output_dir:
        summary_path = get_safe_path(BASE_RESULTS_PATH, db_run.output_dir, "storm_summary.json")
        if summary_path:
            try:
                with open(summary_path, 'r', encoding='utf-8') as f: summary_content = json.load(f)
            except: pass # Silently ignore if summary can't be read for status check
    return schemas.StormRunStatusResponse(job_id=db_run.id, status=db_run.status, topic=db_run.topic, start_time=db_run.start_time, end_time=db_run.end_time, output_dir=db_run.output_dir, error_message=db_run.error_message, summary=summary_content, article_content=article_preview)

@app.get("/storm/history", response_model=list[schemas.StormRunHistoryItem])
async def get_storm_run_history(skip: int = 0, limit: int = 20, db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_active_user)):
    return crud.get_storm_runs_by_user(db=db, user_id=current_user.id, skip=skip, limit=limit)

@app.get("/storm/results/{job_id}/summary")
async def get_storm_run_summary_file(job_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_active_user)):
    db_run = crud.get_storm_run(db=db, run_id=job_id, user_id=current_user.id)
    if not db_run or db_run.status != "completed" or not db_run.output_dir:
        raise HTTPException(status_code=404, detail="Summary not available or run not completed/authorized")
    file_path = get_safe_path(BASE_RESULTS_PATH, db_run.output_dir, "storm_summary.json")
    if not file_path: raise HTTPException(status_code=404, detail="Summary file not found.")
    try:
        with open(file_path, 'r', encoding='utf-8') as f: return json.load(f)
    except: raise HTTPException(status_code=500, detail="Could not read summary file.")

@app.get("/storm/results/{job_id}/article")
async def get_storm_run_article_file(job_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_active_user)):
    db_run = crud.get_storm_run(db=db, run_id=job_id, user_id=current_user.id)
    if not db_run or db_run.status != "completed" or not db_run.output_dir:
        raise HTTPException(status_code=404, detail="Article not available or run not completed/authorized")
    # Attempt to find the main markdown article. 
    # This logic assumes storm_runner.py might name it 'article.md' or '<topic_slug>_article.md' or similar.
    # For now, just trying 'article.md'. This needs to be robust.
    article_filename = "article.md" # TODO: Make this filename discovery more robust based on storm_runner.py
    file_path = get_safe_path(BASE_RESULTS_PATH, db_run.output_dir, article_filename)
    if not file_path:
        # Fallback: Try to find any .md file if primary is not found (simple approach)
        try:
            # Correct pad voor os.listdir: settings.BASE_STORM_OUTPUT_DIR + db_run.output_dir
            full_output_dir_for_list = os.path.join(BASE_RESULTS_PATH, db_run.output_dir)
            files_in_output = os.listdir(full_output_dir_for_list)
            md_files = [f for f in files_in_output if f.endswith('.md')]
            if md_files:
                # Prefer a file that might be named after the topic or a generic 'article.md'
                # This is a basic heuristic
                preferred_files = [f for f in md_files if 'article' in f.lower() or db_run.topic.lower().replace(" ", "_") in f.lower()]
                if preferred_files:
                    file_path = get_safe_path(BASE_RESULTS_PATH, db_run.output_dir, preferred_files[0])
                else:
                    file_path = get_safe_path(BASE_RESULTS_PATH, db_run.output_dir, md_files[0]) # Gebruik settings.BASE_STORM_OUTPUT_DIR # take the first md file found
        except FileNotFoundError:
            pass # output_dir itself might not exist
    
    if not file_path: raise HTTPException(status_code=404, detail=f"Article file ('{article_filename}' or other .md) not found.")
    try:
        with open(file_path, 'r', encoding='utf-8') as f: return Response(content=f.read(), media_type="text/markdown")
    except: raise HTTPException(status_code=500, detail="Could not read article file.") 