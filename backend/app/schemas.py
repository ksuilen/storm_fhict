from pydantic import BaseModel, EmailStr, Field
from typing import Any, Optional, List
from datetime import datetime

# Properties shared by models storing responses or data in DB
class UserBase(BaseModel):
    email: EmailStr
    role: str = "user" # Standaard rol voor nieuwe gebruikers

# Properties to receive via API on user creation
class UserCreate(UserBase):
    password: str
    # De rol wordt geërfd van UserBase, met "user" als default

# Properties stored in DB
class UserInDBBase(UserBase):
    id: int
    is_active: bool

    class Config:
        from_attributes = True

# Properties to return to client
class User(UserInDBBase):
    # id en is_active worden geërfd van UserInDBBase
    # email en role worden geërfd van UserBase via UserInDBBase
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
    role: str | None = None # Rol toevoegen aan token data

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
        from_attributes = True

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

# Nieuw schema voor admin statistieken
class UserRunStats(BaseModel):
    user_id: int
    email: EmailStr
    role: str
    run_count: int 

# --- System Configuration Schemas ---
class SystemConfigurationBase(BaseModel):
    small_model_name: Optional[str] = None
    large_model_name: Optional[str] = None
    small_model_name_azure: Optional[str] = None
    large_model_name_azure: Optional[str] = None
    azure_api_base: Optional[str] = None
    openai_api_base: Optional[str] = None
    
    # API Keys en Type (nieuw)
    openai_api_key: Optional[str] = None # In Pydantic schema's kan het Optional zijn
    openai_api_type: Optional[str] = Field(default=None, pattern="^(openai|azure)$") # "openai" or "azure", valideer input
    azure_api_version: Optional[str] = None
    
    # Retriever Keys
    tavily_api_key: Optional[str] = None

class SystemConfigurationCreate(SystemConfigurationBase):
    pass

class SystemConfigurationUpdate(SystemConfigurationBase):
    pass

class SystemConfigurationInDB(SystemConfigurationBase):
    id: int
    updated_at: datetime
    # openai_api_base is al onderdeel van SystemConfigurationBase

    # Voor Pydantic V1: class Config: orm_mode = True
    # Voor Pydantic V2 (aanbevolen indien uw Pydantic versie dit ondersteunt):
    model_config = {"from_attributes": True}


class SystemConfigurationResponse(BaseModel):
    config: Optional[SystemConfigurationInDB] = None
    # defaults_used: Optional[dict[str, str]] = None # Laten we voor nu weg, kan later toegevoegd worden 