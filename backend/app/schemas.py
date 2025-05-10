from pydantic import BaseModel, EmailStr
from typing import Any, Optional
from datetime import datetime

# Properties shared by models storing responses or data in DB
class UserBase(BaseModel):
    email: EmailStr

# Properties to receive via API on user creation
class UserCreate(UserBase):
    password: str

# Properties stored in DB
class UserInDBBase(UserBase):
    id: int
    is_active: bool

    class Config:
        orm_mode = True

# Properties to return to client
class User(UserInDBBase):
    pass

# Additional properties stored in DB but not returned to client
class UserInDB(UserInDBBase):
    hashed_password: str

# --- Token Schemas (voor later) ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: str | None = None

# --- Storm Schemas ---
class StormQueryRequest(BaseModel):
    query: str
    # Voeg eventueel andere parameters toe die Storm nodig heeft (bv. k=top_k results)
    # k: int | None = None

class StormResponse(BaseModel):
    # Dit is een generieke response. Pas aan naar de structuur die Storm teruggeeft.
    result: Any # Gebruik Any voor nu, specificeer later indien mogelijk 

class StormRunRequest(BaseModel):
    topic: str
    do_research: bool = True
    do_generate_outline: bool = True
    do_generate_article: bool = True
    do_polish_article: bool = True

class StormRunResponse(BaseModel):
    message: str # Succes/error message
    output_dir: Optional[str] = None # Pad naar waar resultaten zijn opgeslagen
    summary: Optional[Any] = None # Resultaat van runner.summary()
    article_content: Optional[str] = None # Probeer article content te lezen (best effort) 

# Storm Run Schemas (nieuw, asynchroon)
class StormRunBase(BaseModel):
    topic: str

class StormRunCreate(StormRunBase):
    pass

class StormRun(StormRunBase):
    id: int
    status: str
    start_time: datetime
    end_time: datetime | None = None
    output_dir: str | None = None
    error_message: str | None = None
    user_id: int
    class Config:
        orm_mode = True

class StormRunJobResponse(BaseModel):
    message: str
    job_id: int
    topic: str
    status: str
    start_time: datetime

class StormRunStatusResponse(BaseModel):
    job_id: int
    status: str
    topic: str
    start_time: datetime
    end_time: datetime | None = None
    output_dir: str | None = None
    error_message: str | None = None
    summary: dict | str | None = None # Voor als we summary direct meesturen
    article_content: str | None = None # Voor als we article preview meesturen

class StormRunHistoryItem(StormRun):
    pass 