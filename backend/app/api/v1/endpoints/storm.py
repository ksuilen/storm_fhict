from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Any, Union

from app import crud, schemas, models # models.User, models.Voucher, models.StormRun
from app.db.session import get_db
from app.core.auth import (
    get_current_actor as get_strict_current_actor, 
    get_current_active_admin, 
    get_current_actor_or_inactive_for_history
)
from app.core.storm_runner import StormRunner, StormConfig  # Aanname dat dit bestaat
from app.schemas.run import StormRunCreate # Moet mogelijk worden aangepast als het user_id bevatte
from app.schemas.storm import StormRunResponse, StormRunStatusResponse, StormRunResultSummary, StormRunResultArticle, StormRunResultOutline
import logging
import os # Voor path joining etc. in resultaat endpoints
from app.core.config import settings # Voor STORM_OUTPUT_DIR
from app.crud.crud_run import create_topic_slug, get_run_output_dir # Importeer helper

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/run", response_model=StormRunResponse) # Of schemas.StormRun (afh. van wat StormRunResponse is)
async def run_storm_process(
    *, 
    db: Session = Depends(get_db),
    run_in: StormRunCreate, # Bevat nu alleen 'topic' typisch
    current_actor: Union[models.User, models.Voucher] = Depends(get_strict_current_actor) # Use the aliased stricter check for starting runs
) -> Any:
    """
    Start a new STORM process for the current actor (admin or voucher).
    """
    owner_type: str
    owner_id: int
    owner_identifier_for_path: str # Voor output directory, bv. admin_id of voucher_code

    if isinstance(current_actor, models.User): # Admin
        owner_type = "admin"
        owner_id = current_actor.id
        owner_identifier_for_path = str(current_actor.id)
    elif isinstance(current_actor, models.Voucher): # Voucher
        if current_actor.used_runs >= current_actor.max_runs:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Voucher has no remaining runs."
            )
        crud.increment_run_count(db=db, db_voucher=current_actor)
        owner_type = "voucher"
        owner_id = current_actor.id
        owner_identifier_for_path = current_actor.code # Gebruik voucher code voor pad
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid actor type")

    # StormRunCreate bevatte mogelijk user_id, nu niet meer direct nodig in schema
    # De owner info komt van de token.
    storm_run_db = crud.create_storm_run(
        db=db, 
        run_in=run_in, 
        owner_type=owner_type, 
        owner_id=owner_id
    )
    
    # De output_dir wordt nu in crud.run.create_storm_run gezet, gebruik makend van voucher code.
    # Als dat niet zo is, of je wilt het hier expliciet doen:
    # topic_slug = create_topic_slug(storm_run_db.topic)
    # storm_run_db.output_dir = get_run_output_dir(
    #     owner_type=owner_type,
    #     owner_identifier=owner_identifier_for_path,
    #     run_id=storm_run_db.id,
    #     topic=storm_run_db.topic
    # )
    # db.add(storm_run_db)
    # db.commit()
    # db.refresh(storm_run_db)

    # Start de daadwerkelijke Storm process (asynchroon, bv. via Celery of background task)
    try:
        config = StormConfig(topic=storm_run_db.topic, output_path=storm_run_db.output_dir)
        # runner = StormRunner(config=config, db_run_id=storm_run_db.id, db_session_factory=db.session_factory) 
        # runner.run_storm_async() # Of iets dergelijks
        logger.info(f"Storm run {storm_run_db.id} for topic '{storm_run_db.topic}' initiated by {owner_type} {owner_id}.")
        # Voor nu, mock de async start en update status direct
        storm_run_db = crud.update_storm_run_status(db, db_run=storm_run_db, status=models.StormRunStatus.running, current_stage="INITIALIZING")

    except Exception as e:
        logger.error(f"Failed to initiate StormRunner for run {storm_run_db.id}: {e}")
        storm_run_db = crud.update_storm_run_status(db, db_run=storm_run_db, status=models.StormRunStatus.failed, error_message=f"Runner init failed: {e}")
        # Overweeg of je hier de voucher run count moet terugdraaien
        if isinstance(current_actor, models.Voucher):
             # Dit vereist een decrement_run_count of een manier om de increment te compenseren.
             pass 

    return storm_run_db # of een specifiek StormRunResponse schema


@router.get("/history", response_model=List[schemas.StormRun]) # Gebruik schemas.StormRun of maak een StormRunDisplay
async def read_run_history(
    db: Session = Depends(get_db),
    current_actor: Union[models.User, models.Voucher] = Depends(get_current_actor_or_inactive_for_history),
    skip: int = 0,
    limit: int = 100
) -> Any:
    """
    Retrieve run history for the current actor.
    Admins see all runs (of een subset), vouchers see only their own runs.
    """
    if isinstance(current_actor, models.User): # Admin
        # Optie 1: Admin ziet alle runs
        runs = crud.get_all_storm_runs_for_admin(db, skip=skip, limit=limit)
        # Optie 2: Admin ziet alleen runs van vouchers die hij/zij heeft aangemaakt + eigen runs
        # Dit vereist complexere query in CRUD laag.
    elif isinstance(current_actor, models.Voucher): # Voucher
        runs = crud.get_storm_runs_for_owner(db, owner_type="voucher", owner_id=current_actor.id, skip=skip, limit=limit)
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid actor type for history")
    return runs

@router.get("/status/{job_id}", response_model=StormRunStatusResponse) # of schemas.StormRun
async def get_storm_run_status_info(
    job_id: int,
    db: Session = Depends(get_db),
    current_actor: Union[models.User, models.Voucher] = Depends(get_current_actor_or_inactive_for_history)
) -> Any:
    """
    Get status of a specific Storm run.
    """
    db_run = crud.get_storm_run(db, run_id=job_id)
    if not db_run:
        raise HTTPException(status_code=404, detail="Run not found")

    # Security check: mag deze actor deze run zien?
    if isinstance(current_actor, models.Voucher):
        if not (db_run.owner_type == "voucher" and db_run.owner_id == current_actor.id):
            raise HTTPException(status_code=403, detail="Not authorized to view this run status")
    # Admins mogen alle run statussen zien (impliciet door geen check hier)
    
    return db_run # of map naar StormRunStatusResponse

# De /results/{job_id}/* endpoints moeten vergelijkbare security checks krijgen.
# Hieronder een voorbeeld voor article. Outline en Summary analoog.

@router.get("/results/{job_id}/article", response_model=StormRunResultArticle) # of plain text
async def get_storm_run_article_file(
    job_id: int, 
    db: Session = Depends(get_db), 
    current_actor: Union[models.User, models.Voucher] = Depends(get_current_actor_or_inactive_for_history)
):
    run = crud.get_storm_run(db, run_id=job_id)
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")

    # Security check
    if isinstance(current_actor, models.Voucher):
        if not (run.owner_type == "voucher" and run.owner_id == current_actor.id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view this article")
    # Admins mogen alle artikelen zien

    if not run.output_dir or not run.topic or run.status != models.StormRunStatus.completed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found or run not completed")

    article_filename = "storm_gen_article_polished.txt" # Of hoe het ook heet
    # Het output_dir in db_run is al correct bepaald (met voucher code of admin id)
    file_path = os.path.join(run.output_dir, article_filename)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{article_filename} not found at {file_path}")
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        return {"article_text": content} # Aanname dat StormRunResultArticle dit verwacht
    except Exception as e:
        logger.error(f"Error reading article file {file_path} for run {job_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error reading article content")

@router.get("/results/{job_id}/outline", response_model=StormRunResultOutline) # Aangepast voor security
async def get_storm_run_outline_file(
    job_id: int,
    db: Session = Depends(get_db),
    current_actor: Union[models.User, models.Voucher] = Depends(get_current_actor_or_inactive_for_history)
):
    run = crud.get_storm_run(db, run_id=job_id)
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")

    if isinstance(current_actor, models.Voucher):
        if not (run.owner_type == "voucher" and run.owner_id == current_actor.id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view this outline")

    if not run.output_dir or run.status != models.StormRunStatus.completed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Outline not found or run not completed")

    outline_filename = "storm_gen_outline.json"
    file_path = os.path.join(run.output_dir, outline_filename)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{outline_filename} not found at {file_path}")

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        # Aanname: StormRunResultOutline verwacht een dict met "outline_content" of iets dergelijks
        # Als het een JSON string direct verwacht, dan `return json.loads(content)` of pas schema aan.
        import json
        return {"outline_content": json.loads(content)} 
    except Exception as e:
        logger.error(f"Error reading outline file {file_path} for run {job_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error reading outline content")

@router.get("/results/{job_id}/summary", response_model=StormRunResultSummary) # Aangepast voor security (was sources)
async def get_storm_run_summary_file(
    job_id: int,
    db: Session = Depends(get_db),
    current_actor: Union[models.User, models.Voucher] = Depends(get_current_actor_or_inactive_for_history)
):
    run = crud.get_storm_run(db, run_id=job_id)
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")

    if isinstance(current_actor, models.Voucher):
        if not (run.owner_type == "voucher" and run.owner_id == current_actor.id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view this summary/sources")

    if not run.output_dir or run.status != models.StormRunStatus.completed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Summary/sources not found or run not completed")

    summary_filename = "storm_gen_search_queries_and_sources.json" 
    file_path = os.path.join(run.output_dir, summary_filename)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{summary_filename} not found at {file_path}")

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        import json
        # Aanname: StormRunResultSummary verwacht een dict met "summary_content" of de JSON direct.
        return {"summary_content": json.loads(content)} 
    except Exception as e:
        logger.error(f"Error reading summary/sources file {file_path} for run {job_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error reading summary/sources content")

@router.delete("/run/{job_id}", status_code=status.HTTP_200_OK) # Aangepast voor nieuwe auth
async def delete_storm_run_endpoint(
    job_id: int,
    db: Session = Depends(get_db),
    current_actor: Union[models.User, models.Voucher] = Depends(get_strict_current_actor) # Use aliased stricter check for delete
) -> Any:
    run_to_delete = crud.get_storm_run(db, run_id=job_id)
    if not run_to_delete:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")

    deleted_run = None
    if isinstance(current_actor, models.User): # Admin
        # Admins mogen elke run verwijderen
        deleted_run = crud.delete_storm_run_by_admin(db=db, run_id=job_id)
    elif isinstance(current_actor, models.Voucher): # Voucher
        # Vouchers mogen alleen hun eigen runs verwijderen
        if run_to_delete.owner_type == "voucher" and run_to_delete.owner_id == current_actor.id:
            deleted_run = crud.delete_storm_run(db=db, run_id=job_id, owner_type="voucher", owner_id=current_actor.id)
        else:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this run")
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid actor type for deletion")

    if not deleted_run:
        # Dit kan gebeuren als de run net verwijderd is door een andere request, of als er een fout was in delete_storm_run
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run could not be deleted or was already deleted")

    # Optioneel: fysiek verwijderen van output_dir (als niet in CRUD gedaan)
    # if deleted_run.output_dir and os.path.exists(deleted_run.output_dir):
    #     import shutil
    #     shutil.rmtree(deleted_run.output_dir)
    #     logger.info(f"Successfully deleted output directory: {deleted_run.output_dir}")

    return {"message": "Storm run deleted successfully", "run_id": job_id} 