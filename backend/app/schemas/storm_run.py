from pydantic import BaseModel
from typing import Any, Optional
from datetime import datetime

from app.models.run import StormRunStatus # Importeer de Enum

# Storm Run Schemas
class StormRunBase(BaseModel):
    topic: str

class StormRunCreate(StormRunBase):
    pass

class StormRunUpdate(BaseModel): # Toegevoegd voor consistentie, pas aan indien nodig
    topic: Optional[str] = None
    status: Optional[StormRunStatus] = None # Gebruik Enum
    current_stage: Optional[str] = None
    error_message: Optional[str] = None

class StormRun(StormRunBase):
    id: int
    status: StormRunStatus # Gebruik Enum
    current_stage: Optional[str] = None
    start_time: datetime
    end_time: datetime | None = None
    output_dir: str | None = None
    error_message: str | None = None
    # user_id is vervangen door owner_type/owner_id in het model
    # In Pydantic schema's die de DB representeren, wil je dit mogelijk ook reflecteren
    # of een specifiek display schema maken.
    # Voor nu, als de StormRun die CRUD teruggeeft user_id nog heeft, laten we het zo.
    # Als het is aangepast naar owner_type/owner_id in de response, dan hier ook aanpassen.
    owner_type: str # Moet aanwezig zijn
    owner_id: int   # Moet aanwezig zijn

    class Config:
        from_attributes = True # Pydantic V2

class StormRunJobResponse(BaseModel):
    message: str
    job_id: int
    topic: str
    status: StormRunStatus # Gebruik Enum
    start_time: datetime

class StormRunStatusResponse(BaseModel):
    job_id: int
    status: StormRunStatus # Gebruik Enum
    current_stage: Optional[str] = None
    topic: str
    start_time: datetime
    end_time: datetime | None = None
    output_dir: str | None = None
    error_message: str | None = None
    summary: dict | str | None = None
    article_content: str | None = None

class StormRunHistoryItem(StormRun):
    pass

# Nieuw schema voor admin statistieken (kan ook naar user.py als het meer user-gerelateerd is)
class UserRunStats(BaseModel):
    user_id: int
    # email: EmailStr # Vereist EmailStr import
    email: str # Tijdelijk str, import EmailStr als nodig
    role: str
    run_count: int 