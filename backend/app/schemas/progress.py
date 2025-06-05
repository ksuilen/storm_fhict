from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Dict, Any

class StormProgressUpdateBase(BaseModel):
    run_id: int
    timestamp: datetime
    phase: str
    status: str
    message: str
    progress: int
    details: Optional[Dict[str, Any]] = None

class StormProgressUpdateCreate(StormProgressUpdateBase):
    pass

class StormProgressUpdate(StormProgressUpdateBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True 