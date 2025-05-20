from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func 
from sqlalchemy.types import Text

from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    role = Column(String, default="user", nullable=False)
    storm_runs = relationship("StormRun", back_populates="owner")

    # Je kunt hier later relaties toevoegen, bv. naar opgeslagen Storm queries 

class StormRun(Base):
    __tablename__ = "storm_runs"
    id = Column(Integer, primary_key=True, index=True)
    topic = Column(String, index=True)
    status = Column(String, default="pending") # Hoofdstatus: pending, running, completed, failed
    current_stage = Column(String, nullable=True) # Gedetailleerde stage van de run
    start_time = Column(DateTime(timezone=True), server_default=func.now())
    end_time = Column(DateTime(timezone=True), nullable=True)
    output_dir = Column(String, nullable=True)
    error_message = Column(String, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="storm_runs") 

# Nieuw model voor systeemconfiguratie
class SystemConfiguration(Base):
    __tablename__ = "system_configuration"

    id = Column(Integer, primary_key=True, default=1) # Altijd id 1
    
    # Model namen
    small_model_name = Column(String, nullable=True)
    large_model_name = Column(String, nullable=True)
    small_model_name_azure = Column(String, nullable=True)
    large_model_name_azure = Column(String, nullable=True)
    
    # Azure specifieke settings
    azure_api_base = Column(String, nullable=True) 
    # Nieuw veld voor OpenAI base URL
    openai_api_base = Column(String, nullable=True)
    
    # API Keys en Type (nieuw)
    openai_api_key = Column(String, nullable=True) # Let op: wordt plain text opgeslagen in DB
    openai_api_type = Column(String, nullable=True) # "openai" or "azure"
    azure_api_version = Column(String, nullable=True)
    
    # Retriever Keys (voorbeeld Tavily, andere kunnen volgen)
    tavily_api_key = Column(String, nullable=True) # Let op: wordt plain text opgeslagen in DB
    
    # azure_api_version blijft in env/config.py # Commentaar kan weg of aangepast
    # OPENAI_API_KEY blijft ook in env/config.py # Commentaar kan weg of aangepast

    # Timestamps
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now()) 