from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

# --- System Configuration Schemas ---
class SystemConfigurationBase(BaseModel):
    small_model_name: Optional[str] = None
    large_model_name: Optional[str] = None
    small_model_name_azure: Optional[str] = None
    large_model_name_azure: Optional[str] = None
    azure_api_base: Optional[str] = None
    openai_api_base: Optional[str] = None
    
    openai_api_key: Optional[str] = None
    openai_api_type: Optional[str] = Field(default=None, pattern="^(openai|azure)$")
    azure_api_version: Optional[str] = None
    
    tavily_api_key: Optional[str] = None

class SystemConfigurationCreate(SystemConfigurationBase):
    pass

class SystemConfigurationUpdate(SystemConfigurationBase):
    pass

class SystemConfigurationInDB(SystemConfigurationBase):
    id: int
    updated_at: datetime

    model_config = {"from_attributes": True} # Pydantic V2

class SystemConfigurationResponse(BaseModel):
    config: Optional[SystemConfigurationInDB] = None 