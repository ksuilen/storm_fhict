from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from app.database import Base

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
    openai_api_base = Column(String, nullable=True)
    
    # API Keys en Type
    openai_api_key = Column(String, nullable=True) # Opgeslagen in DB
    openai_api_type = Column(String, nullable=True) # "openai" or "azure"
    azure_api_version = Column(String, nullable=True)
    
    # Retriever Keys
    tavily_api_key = Column(String, nullable=True) # Opgeslagen in DB
    
    # Timestamps
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<SystemConfiguration(id={self.id})>" 